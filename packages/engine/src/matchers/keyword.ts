import type { Rule, Matcher, MatcherContext, MatchResult, MatchStatus } from "../types.js"

interface RuleConcepts {
  readonly keywords: readonly string[]
  readonly prohibitions: readonly string[]
  readonly prohibitedSubjects: readonly string[]
  readonly requirements: readonly string[]
}

const NEGATION_PREFIXES = [
  "ensure no",
  "ensure that no",
  "prevent",
  "avoid",
  "will not",
  "won't",
  "without",
  "never",
  "eliminate",
  "remove all",
  "forbid",
  "block",
  "disallow",
  "reject",
  "no",
  "don't",
  "do not",
  "must not",
  "should not",
  "shouldn't",
] as const

const PROHIBIT_PATTERNS = [
  /never\s+(\w+(?:\s+\w+){0,3})/gi,
  /must\s+not\s+(\w+(?:\s+\w+){0,3})/gi,
  /avoid\s+(\w+(?:\s+\w+){0,2})/gi,
  /don[''\u2019t]+\s+(\w+(?:\s+\w+){0,2})/gi,
  /no\s+(\w+(?:\s+\w+){0,2})/gi,
]

const REQUIRE_PATTERNS = [
  /must\s+(?:be\s+)?(\w+(?:\s+\w+){0,3})/gi,
  /always\s+(\w+(?:\s+\w+){0,2})/gi,
  /require[sd]?\s+(\w+(?:\s+\w+){0,2})/gi,
]

const COMPLIANCE_INDICATORS = [
  "ensure",
  "prevent",
  "avoid",
  "protect",
  "secure",
  "validate",
  "verify",
  "check",
  "enforce",
  "require",
  "use environment",
  "use env",
  "from env",
  "load from",
  "secrets manager",
] as const

const LITERAL_SECRET_PATTERNS = [
  /["']sk_(?:live|test)_\w+["']/i,
  /["'](?:api[_-]?key|token|password|secret)[_-]?\w*["']\s*(?:=|:)/i,
  /(?:set|assign|put|write|store)\s+(?:the\s+)?(?:api[_-]?\s*key|token|password|secret)\s+to\s+["']/i,
  /(?:=|:)\s*["'](?:sk|pk|ak|key)[_-]\w{5,}["']/i,
] as const

function extractKeywords(title: string, tags: readonly string[], category: string): readonly string[] {
  const titleWords = title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)

  return [...titleWords, ...tags.map((t) => t.toLowerCase()), category.toLowerCase()]
}

function extractProhibitions(allText: string): readonly string[] {
  const prohibitions: string[] = []

  for (const pattern of PROHIBIT_PATTERNS) {
    pattern.lastIndex = 0
    let match = pattern.exec(allText)
    while (match !== null) {
      prohibitions.push((match[1] ?? match[0]).trim().toLowerCase())
      match = pattern.exec(allText)
    }
  }

  const negTitleMatch = allText.match(/\bno\s+(\w+)/i)
  if (negTitleMatch) {
    prohibitions.push(negTitleMatch[1].toLowerCase())
  }

  return prohibitions
}

function extractRequirements(allText: string): readonly string[] {
  const requirements: string[] = []

  for (const pattern of REQUIRE_PATTERNS) {
    pattern.lastIndex = 0
    let match = pattern.exec(allText)
    while (match !== null) {
      if (!match[0].toLowerCase().includes("must not")) {
        requirements.push((match[1] ?? match[0]).trim().toLowerCase())
      }
      match = pattern.exec(allText)
    }
  }

  return requirements
}

function extractProhibitedSubjects(prohibitions: readonly string[]): readonly string[] {
  const subjects: string[] = []

  for (const prohibition of prohibitions) {
    const words = prohibition.split(/\s+/)
    if (words.length > 1) {
      subjects.push(words.slice(1).join(" "))
      for (const word of words.slice(1)) {
        if (word.length > 3) subjects.push(word)
      }
    }
  }

  return [...new Set(subjects)]
}

function extractRuleConcepts(rule: Rule): RuleConcepts {
  const allText = `${rule.title.toLowerCase()} ${rule.content.toLowerCase()}`
  const prohibitions = extractProhibitions(allText)

  return {
    keywords: extractKeywords(rule.title, rule.tags, rule.category),
    prohibitions,
    prohibitedSubjects: extractProhibitedSubjects(prohibitions),
    requirements: extractRequirements(allText),
  }
}

function isNegatedInContext(planLower: string, word: string, windowSize: number): boolean {
  let searchStart = 0
  while (true) {
    const idx = planLower.indexOf(word, searchStart)
    if (idx === -1) break

    const windowStart = Math.max(0, idx - windowSize)
    const preceding = planLower.slice(windowStart, idx)
    const hasNegation = NEGATION_PREFIXES.some((prefix) => preceding.includes(prefix))

    if (!hasNegation) return false
    searchStart = idx + word.length
  }

  return true
}

function findViolations(planLower: string, prohibitions: readonly string[]): readonly string[] {
  const violations: string[] = []

  for (const prohibition of prohibitions) {
    const words = prohibition.split(/\s+/).filter((w) => w.length > 2)
    if (words.length === 0) continue

    const significantWords = words.filter((w) => w.length > 3)
    let matched = false

    if (significantWords.length > 0 && significantWords.every((w) => planLower.includes(w))) {
      matched = true
    } else if (words.length === 1 && words[0].length > 4 && planLower.includes(words[0])) {
      matched = true
    }

    if (!matched) continue

    const checkWord = significantWords.length > 0 ? significantWords[0] : words[0]
    if (!planLower.includes(checkWord)) {
      violations.push(prohibition)
      continue
    }

    if (!isNegatedInContext(planLower, checkWord, 60)) {
      violations.push(prohibition)
    }
  }

  return violations
}

function containsLiteralSecrets(planLower: string): boolean {
  return LITERAL_SECRET_PATTERNS.some((pattern) => pattern.test(planLower))
}

function findSubjectViolations(
  planLower: string,
  prohibitedSubjects: readonly string[],
  ruleContent: string
): readonly string[] {
  const hasComplianceLanguage = COMPLIANCE_INDICATORS.some((ind) => planLower.includes(ind))
  if (hasComplianceLanguage) return []

  const violations: string[] = []

  if (containsLiteralSecrets(planLower)) {
    const ruleAboutSecrets = /secret|key|token|password|credential/i.test(ruleContent)
    if (ruleAboutSecrets) {
      violations.push("literal secret value in plan")
      return violations
    }
  }

  for (const subject of prohibitedSubjects) {
    if (subject.length < 3) continue
    if (!planLower.includes(subject)) continue
    if (!isNegatedInContext(planLower, subject, 60)) {
      violations.push(subject)
    }
  }

  return violations
}

function computeAddressScore(
  planLower: string,
  keywords: readonly string[],
  requirements: readonly string[]
): { isAddressed: boolean; matchedKeywords: readonly string[] } {
  const keywordMatches = keywords.filter((kw) => planLower.includes(kw))
  const requirementMatches = requirements.filter((req) => {
    const words = req.split(/\s+/).filter((w) => w.length > 3)
    return words.length > 0 && words.some((w) => planLower.includes(w))
  })

  const addressRatio = keywords.length > 0 ? keywordMatches.length / keywords.length : 0
  return {
    isAddressed: addressRatio > 0.3 || requirementMatches.length > 0,
    matchedKeywords: keywordMatches,
  }
}

function buildResult(
  ruleId: string,
  status: MatchStatus,
  confidence: number,
  reason: string,
  suggestedFix?: string
): MatchResult {
  const base: MatchResult = { ruleId, status, confidence, reason }
  return suggestedFix !== undefined ? { ...base, suggestedFix } : base
}

export class KeywordMatcher implements Matcher {
  readonly name = "keyword"

  async match(context: MatcherContext): Promise<readonly MatchResult[]> {
    const { plan, rules } = context
    const planLower = plan.toLowerCase()
    const results: MatchResult[] = []

    for (const rule of rules) {
      const { keywords, prohibitions, prohibitedSubjects, requirements } = extractRuleConcepts(rule)

      const violations = findViolations(planLower, prohibitions)
      const subjectViolations = violations.length === 0
        ? findSubjectViolations(planLower, prohibitedSubjects, rule.content)
        : []
      const allViolations = [...violations, ...subjectViolations]

      const { isAddressed, matchedKeywords } = computeAddressScore(planLower, keywords, requirements)

      if (allViolations.length > 0) {
        const firstBullet = rule.content.split("\n").find((l) => l.startsWith("- "))
        const suggestedFix = firstBullet
          ? `Follow: ${firstBullet.replace(/^-\s*/, "").trim()}`
          : `Review rule "${rule.title}" and adjust plan accordingly`

        results.push(buildResult(rule.id, "VIOLATED", 0.6, `Plan violates prohibition: "${allViolations[0]}"`, suggestedFix))
      } else if (isAddressed) {
        const confidence = matchedKeywords.length > 2 ? 0.7 : 0.4
        results.push(buildResult(rule.id, "PASS", confidence, `Plan addresses rule keywords: ${matchedKeywords.slice(0, 3).join(", ")}`))
      } else {
        results.push(buildResult(rule.id, "NOT_COVERED", 0.3, "Rule not addressed in plan"))
      }
    }

    return results
  }
}
