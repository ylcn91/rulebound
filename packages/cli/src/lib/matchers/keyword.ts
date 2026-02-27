import type { Matcher, MatcherContext, MatchResult, MatchStatus } from "./types.js"

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

/**
 * Words that indicate the plan is discussing compliance/prevention rather than violation.
 */
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

/**
 * Patterns that look like literal hardcoded secrets in plan text.
 */
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

  const tagWords = tags.map((t) => t.toLowerCase())
  const categoryWord = category.toLowerCase()

  return [...titleWords, ...tagWords, categoryWord]
}

function extractProhibitions(allText: string): readonly string[] {
  const prohibitions: string[] = []

  for (const pattern of PROHIBIT_PATTERNS) {
    // Reset lastIndex for each use since patterns have the global flag
    pattern.lastIndex = 0
    let match = pattern.exec(allText)
    while (match !== null) {
      prohibitions.push((match[1] ?? match[0]).trim().toLowerCase())
      match = pattern.exec(allText)
    }
  }

  // Extract negative concepts from title patterns like "No Hardcoded Secrets"
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

/**
 * Extract the subject nouns from prohibition phrases.
 * E.g., "hardcode api keys passwords" -> ["api keys", "passwords", "api", "keys"]
 * These are the _things_ that are prohibited, used for subject-based violation detection.
 *
 * Only extracts subjects from prohibition phrases — NOT from tags or rule category,
 * since tags describe what the rule is _about_, not what is _prohibited_.
 */
function extractProhibitedSubjects(
  prohibitions: readonly string[]
): readonly string[] {
  const subjects: string[] = []

  for (const prohibition of prohibitions) {
    // Split into words, skip the verb (first word which is the action like "hardcode")
    const words = prohibition.split(/\s+/)
    if (words.length > 1) {
      // Add the subject portion (everything after the verb)
      const subjectPhrase = words.slice(1).join(" ")
      subjects.push(subjectPhrase)
      // Also add individual significant subject words
      for (const word of words.slice(1)) {
        if (word.length > 3) {
          subjects.push(word)
        }
      }
    }
  }

  return [...new Set(subjects)]
}

function extractRuleConcepts(rule: {
  readonly title: string
  readonly content: string
  readonly tags: readonly string[]
  readonly category: string
}): RuleConcepts {
  const allText = `${rule.title.toLowerCase()} ${rule.content.toLowerCase()}`
  const prohibitions = extractProhibitions(allText)

  return {
    keywords: extractKeywords(rule.title, rule.tags, rule.category),
    prohibitions,
    prohibitedSubjects: extractProhibitedSubjects(prohibitions),
    requirements: extractRequirements(allText),
  }
}

/**
 * Check if the prohibited word at a given position in the plan text
 * is preceded by a negation prefix within `windowSize` characters.
 * If so, the plan is actually _addressing_ the prohibition, not violating it.
 */
function isNegatedInContext(planLower: string, word: string, windowSize: number): boolean {
  let searchStart = 0
  // Check every occurrence of the word in the plan
  while (true) {
    const idx = planLower.indexOf(word, searchStart)
    if (idx === -1) break

    const windowStart = Math.max(0, idx - windowSize)
    const preceding = planLower.slice(windowStart, idx)

    const hasNegation = NEGATION_PREFIXES.some((prefix) => preceding.includes(prefix))
    if (!hasNegation) {
      // Found an occurrence that is NOT negated — this is a real violation
      return false
    }

    searchStart = idx + word.length
  }

  // All occurrences are negated (or the word doesn't appear, but caller already checked)
  return true
}

function findViolations(
  planLower: string,
  prohibitions: readonly string[]
): readonly string[] {
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

    // Pick the most significant word to check for negation context
    const checkWord = significantWords.length > 0 ? significantWords[0] : words[0]

    // Guard: if checkWord isn't actually in the plan, don't suppress — treat as violation
    if (!planLower.includes(checkWord)) {
      violations.push(prohibition)
      continue
    }

    const negated = isNegatedInContext(planLower, checkWord, 60)

    if (!negated) {
      violations.push(prohibition)
    }
  }

  return violations
}

/**
 * Check if the plan contains literal hardcoded secret patterns.
 */
function containsLiteralSecrets(planLower: string): boolean {
  return LITERAL_SECRET_PATTERNS.some((pattern) => pattern.test(planLower))
}

/**
 * Check if the plan mentions prohibited subjects in a non-compliant way.
 * Returns violation descriptions if found, empty array otherwise.
 *
 * A "subject violation" occurs when:
 * 1. The plan mentions a prohibited subject (e.g., "api key")
 * 2. The plan does NOT contain compliance language around that subject
 * 3. The plan context suggests direct usage (setting, storing) rather than prevention
 */
function findSubjectViolations(
  planLower: string,
  prohibitedSubjects: readonly string[],
  ruleContent: string
): readonly string[] {
  const hasComplianceLanguage = COMPLIANCE_INDICATORS.some((ind) => planLower.includes(ind))

  // If the plan has overall compliance language, subjects are probably discussed
  // in a preventive context, not a violating one
  if (hasComplianceLanguage) {
    return []
  }

  const violations: string[] = []

  // Check for literal secret patterns first — strongest signal
  if (containsLiteralSecrets(planLower)) {
    // If the rule is about secrets/keys and plan has literal secrets, that's a violation
    const ruleAboutSecrets = /secret|key|token|password|credential/i.test(ruleContent)
    if (ruleAboutSecrets) {
      violations.push("literal secret value in plan")
      return violations
    }
  }

  // Check prohibited subjects
  for (const subject of prohibitedSubjects) {
    if (subject.length < 3) continue
    if (!planLower.includes(subject)) continue

    // Subject is mentioned — check if it's negated in context
    const negated = isNegatedInContext(planLower, subject, 60)
    if (!negated) {
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
  const isAddressed = addressRatio > 0.3 || requirementMatches.length > 0

  return { isAddressed, matchedKeywords: keywordMatches }
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

      // 1. Check for violations (prohibition matches that are NOT negated)
      const violations = findViolations(planLower, prohibitions)

      // 2. Check for subject-based violations (prohibited subjects mentioned without compliance)
      const subjectViolations = violations.length === 0
        ? findSubjectViolations(planLower, prohibitedSubjects, rule.content)
        : []

      const allViolations = [...violations, ...subjectViolations]

      // 3. Check if plan addresses the rule
      const { isAddressed, matchedKeywords } = computeAddressScore(
        planLower,
        keywords,
        requirements
      )

      if (allViolations.length > 0) {
        const firstBullet = rule.content.split("\n").find((l) => l.startsWith("- "))
        const suggestedFix = firstBullet
          ? `Follow: ${firstBullet.replace(/^-\s*/, "").trim()}`
          : `Review rule "${rule.title}" and adjust plan accordingly`

        results.push(
          buildResult(
            rule.id,
            "VIOLATED",
            0.6,
            `Plan violates prohibition: "${allViolations[0]}"`,
            suggestedFix
          )
        )
      } else if (isAddressed) {
        // Negated prohibitions actually mean the plan is addressing the rule well
        const confidence = matchedKeywords.length > 2 ? 0.7 : 0.4
        results.push(
          buildResult(
            rule.id,
            "PASS",
            confidence,
            `Plan addresses rule keywords: ${matchedKeywords.slice(0, 3).join(", ")}`
          )
        )
      } else {
        results.push(
          buildResult(
            rule.id,
            "NOT_COVERED",
            0.3,
            "Rule not addressed in plan"
          )
        )
      }
    }

    return results
  }
}
