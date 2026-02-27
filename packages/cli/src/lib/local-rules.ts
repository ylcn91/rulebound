import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join, relative } from "node:path"

export interface LocalRule {
  id: string
  title: string
  content: string
  category: string
  severity: string
  modality: string
  tags: string[]
  stack: string[]
  scope: string[]
  changeTypes: string[]
  team: string[]
  filePath: string
}

interface FrontMatter {
  title?: string
  category?: string
  severity?: string
  modality?: string
  tags?: string[]
  stack?: string[]
  scope?: string[]
  "change-types"?: string[]
  team?: string[]
}

function parseArrayValue(value: string): string[] {
  const bracketMatch = value.match(/\[([^\]]*)\]/)
  if (bracketMatch) {
    return bracketMatch[1].split(",").map((t) => t.trim()).filter(Boolean)
  }
  return value.split(",").map((t) => t.trim()).filter(Boolean)
}

function parseFrontMatter(raw: string): { meta: FrontMatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }

  const meta: FrontMatter = {}
  const lines = match[1].split("\n")

  for (const line of lines) {
    const kv = line.match(/^([\w-]+):\s*(.+)$/)
    if (!kv) continue

    const [, key, value] = kv
    const arrayFields = ["tags", "stack", "scope", "change-types", "team"]
    if (arrayFields.includes(key)) {
      (meta as Record<string, string[]>)[key] = parseArrayValue(value)
    } else {
      (meta as Record<string, string>)[key] = value.replace(/^["']|["']$/g, "")
    }
  }

  return { meta, body: match[2].trim() }
}

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = []

  function walk(current: string) {
    const entries = readdirSync(current)
    for (const entry of entries) {
      const full = join(current, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walk(full)
      } else if (entry.endsWith(".md")) {
        files.push(full)
      }
    }
  }

  walk(dir)
  return files
}

export function findRulesDir(cwd: string): string | null {
  const candidates = [
    join(cwd, ".rulebound", "rules"),
    join(cwd, "rules"),
    join(cwd, "examples", "rules"),
  ]

  for (const dir of candidates) {
    if (existsSync(dir) && statSync(dir).isDirectory()) {
      return dir
    }
  }

  return null
}

export function loadLocalRules(rulesDir: string): LocalRule[] {
  const files = collectMarkdownFiles(rulesDir)
  const rules: LocalRule[] = []

  for (const file of files) {
    const raw = readFileSync(file, "utf-8")
    const { meta, body } = parseFrontMatter(raw)

    const relPath = relative(rulesDir, file)
    const category = meta.category ?? relPath.split("/")[0] ?? "general"

    rules.push({
      id: relPath.replace(/\.md$/, "").replace(/[/\\]/g, "."),
      title: meta.title ?? relPath.replace(/\.md$/, ""),
      content: body,
      category,
      severity: meta.severity ?? "warning",
      modality: meta.modality ?? "should",
      tags: meta.tags ?? [],
      stack: meta.stack ?? [],
      scope: meta.scope ?? [],
      changeTypes: meta["change-types"] ?? [],
      team: meta.team ?? [],
      filePath: relPath,
    })
  }

  return rules
}

export interface ProjectConfig {
  name?: string
  stack?: string[]
  scope?: string[]
  team?: string
}

/**
 * Smart context-based rule matching.
 * 
 * Scoring:
 * - +3 for each stack match (rule.stack ∩ project.stack)
 * - +2 for each scope match
 * - +1 for team match
 * - Rules with no stack/scope/team metadata = global, always included
 * - Rules with metadata but score 0 = not relevant, excluded
 */
export function matchRulesByContext(
  rules: LocalRule[],
  projectConfig?: ProjectConfig | null,
  task?: string
): LocalRule[] {
  let matched: Array<{ rule: LocalRule; score: number }> = []

  for (const rule of rules) {
    const hasMetadata = rule.stack.length > 0 || rule.scope.length > 0 || rule.team.length > 0
    
    if (!projectConfig || !hasMetadata) {
      // Global rule or no project config — always include
      matched.push({ rule, score: hasMetadata ? 0 : 1 })
      continue
    }

    let score = 0

    // Stack matching
    if (rule.stack.length > 0 && projectConfig.stack) {
      const stackMatches = rule.stack.filter((s) =>
        projectConfig.stack!.map((ps) => ps.toLowerCase()).includes(s.toLowerCase())
      ).length
      score += stackMatches * 3
    }

    // Scope matching
    if (rule.scope.length > 0 && projectConfig.scope) {
      const scopeMatches = rule.scope.filter((s) =>
        projectConfig.scope!.map((ps) => ps.toLowerCase()).includes(s.toLowerCase())
      ).length
      score += scopeMatches * 2
    }

    // Team matching
    if (rule.team.length > 0 && projectConfig.team) {
      const teamMatch = rule.team.some((t) =>
        t.toLowerCase() === projectConfig.team!.toLowerCase()
      )
      if (teamMatch) score += 1
    }

    // Rules with metadata but no match = not relevant
    if (score > 0 || !hasMetadata) {
      matched.push({ rule, score })
    }
  }

  // Task-based filtering (additional)
  if (task) {
    const taskLower = task.toLowerCase()
    const taskWords = taskLower.split(/\s+/).filter((w) => w.length > 3)

    matched = matched.filter(({ rule }) => {
      const hasContextMatch = rule.stack.length > 0 || rule.scope.length > 0
      if (hasContextMatch) return true

      // Global rules: filter by task relevance
      const ruleText = `${rule.title} ${rule.tags.join(" ")} ${rule.category} ${rule.stack.join(" ")}`.toLowerCase()
      return taskWords.some((word) => ruleText.includes(word))
    })
  }

  // Sort by score descending
  matched.sort((a, b) => b.score - a.score)

  return matched.map((m) => m.rule)
}

/**
 * Legacy filter for backward compatibility (used by find-rules).
 */
export function filterRules(
  rules: LocalRule[],
  opts: {
    title?: string
    category?: string
    tags?: string
    task?: string
    stack?: string
  }
): LocalRule[] {
  let filtered = [...rules]

  if (opts.title) {
    const q = opts.title.toLowerCase()
    filtered = filtered.filter((r) =>
      r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
    )
  }

  if (opts.category) {
    const cat = opts.category.toLowerCase()
    filtered = filtered.filter((r) => r.category.toLowerCase() === cat)
  }

  if (opts.tags) {
    const tagList = opts.tags.split(",").map((t) => t.trim().toLowerCase())
    filtered = filtered.filter((r) =>
      tagList.some((t) => r.tags.map((rt) => rt.toLowerCase()).includes(t))
    )
  }

  if (opts.stack) {
    const stackList = opts.stack.split(",").map((s) => s.trim().toLowerCase())
    filtered = filtered.filter((r) =>
      r.stack.length === 0 || r.stack.some((s) => stackList.includes(s.toLowerCase()))
    )
  }

  if (opts.task) {
    const taskLower = opts.task.toLowerCase()
    const taskWords = taskLower.split(/\s+/).filter((w) => w.length > 3)

    filtered = filtered.filter((r) => {
      const ruleText = `${r.title} ${r.content} ${r.tags.join(" ")} ${r.category} ${r.stack.join(" ")}`.toLowerCase()
      return taskWords.some((word) => ruleText.includes(word))
    })
  }

  return filtered
}

export interface ValidationResult {
  ruleId: string
  ruleTitle: string
  severity: string
  modality: string
  status: "PASS" | "VIOLATED" | "NOT_COVERED"
  reason: string
  suggestedFix?: string
}

export interface ValidationReport {
  task: string
  rulesMatched: number
  rulesTotal: number
  results: ValidationResult[]
  summary: { pass: number; violated: number; notCovered: number }
  status: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED"
}

/**
 * Extract key concepts from a rule for matching.
 * Returns action verbs, nouns, and important phrases.
 */
function extractRuleConcepts(rule: LocalRule): {
  keywords: string[]
  prohibitions: string[]
  requirements: string[]
} {
  const content = rule.content.toLowerCase()
  const title = rule.title.toLowerCase()
  const allText = `${title} ${content}`

  // Extract keywords from title and tags
  const keywords: string[] = []
  const titleWords = title.split(/\s+/).filter((w) => w.length > 3)
  keywords.push(...titleWords)
  keywords.push(...rule.tags.map((t) => t.toLowerCase()))
  keywords.push(rule.category.toLowerCase())

  // Extract prohibitions (things the rule says NOT to do)
  const prohibitions: string[] = []
  const prohibitPatterns = [
    /never\s+(\w+(?:\s+\w+){0,3})/gi,
    /must\s+not\s+(\w+(?:\s+\w+){0,3})/gi,
    /no\s+(\w+(?:\s+\w+){0,2})/gi,
    /avoid\s+(\w+(?:\s+\w+){0,2})/gi,
    /forbidden/gi,
    /don['']t\s+(\w+(?:\s+\w+){0,2})/gi,
  ]
  for (const pat of prohibitPatterns) {
    let m
    while ((m = pat.exec(allText)) !== null) {
      prohibitions.push((m[1] ?? m[0]).trim().toLowerCase())
    }
  }

  // Also extract negative concepts from title (e.g., "No Hardcoded Secrets" → "hardcoded")
  const negTitleMatch = title.match(/\bno\s+(\w+)/i)
  if (negTitleMatch) {
    prohibitions.push(negTitleMatch[1].toLowerCase())
  }

  // Extract requirements (things the rule says TO do)
  const requirements: string[] = []
  const requirePatterns = [
    /must\s+(?:be\s+)?(\w+(?:\s+\w+){0,3})/gi,
    /always\s+(\w+(?:\s+\w+){0,2})/gi,
    /require[sd]?\s+(\w+(?:\s+\w+){0,2})/gi,
  ]
  for (const pat of requirePatterns) {
    let m
    while ((m = pat.exec(allText)) !== null) {
      if (!m[0].toLowerCase().includes("must not")) {
        requirements.push((m[1] ?? m[0]).trim().toLowerCase())
      }
    }
  }

  return { keywords, prohibitions, requirements }
}

export function validatePlanAgainstRules(
  plan: string,
  rules: LocalRule[],
  task?: string
): ValidationReport {
  const planLower = plan.toLowerCase()
  const results: ValidationResult[] = []

  for (const rule of rules) {
    const { keywords, prohibitions, requirements } = extractRuleConcepts(rule)

    // Check if plan VIOLATES the rule (mentions prohibited things)
    const violationMatches: string[] = []
    for (const prohibition of prohibitions) {
      const words = prohibition.split(/\s+/).filter((w) => w.length > 2)
      if (words.length === 0) continue
      // For single-word prohibitions, direct match
      // For multi-word, all significant words must appear
      const significantWords = words.filter((w) => w.length > 3)
      if (significantWords.length > 0 && significantWords.every((w) => planLower.includes(w))) {
        violationMatches.push(prohibition)
      } else if (words.length === 1 && words[0].length > 4 && planLower.includes(words[0])) {
        violationMatches.push(prohibition)
      }
    }

    // Check if plan ADDRESSES the rule
    const keywordMatches = keywords.filter((kw) => planLower.includes(kw))
    const requirementMatches = requirements.filter((req) => {
      const words = req.split(/\s+/).filter((w) => w.length > 3)
      return words.length > 0 && words.some((w) => planLower.includes(w))
    })

    const addressRatio = keywords.length > 0 ? keywordMatches.length / keywords.length : 0
    const isAddressed = addressRatio > 0.3 || requirementMatches.length > 0

    if (violationMatches.length > 0) {
      // Plan contradicts the rule
      const firstBullet = rule.content.split("\n").find((l) => l.startsWith("- "))
      results.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        severity: rule.severity,
        modality: rule.modality,
        status: "VIOLATED",
        reason: `Plan contradicts rule: mentions "${violationMatches[0]}"`,
        suggestedFix: firstBullet
          ? `Follow: ${firstBullet.replace(/^-\s*/, "").trim()}`
          : `Review rule "${rule.title}" and adjust plan accordingly`,
      })
    } else if (isAddressed) {
      // Plan addresses the rule
      results.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        severity: rule.severity,
        modality: rule.modality,
        status: "PASS",
        reason: `Plan addresses: ${keywordMatches.slice(0, 3).join(", ")}`,
      })
    } else {
      // Rule is relevant but not mentioned
      const status: "VIOLATED" | "NOT_COVERED" = "NOT_COVERED"
      const firstBullet = rule.content.split("\n").find((l) => l.startsWith("- "))
      results.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        severity: rule.severity,
        modality: rule.modality,
        status,
        reason: `Rule not addressed in plan — verify manually`,
        suggestedFix: firstBullet
          ? `Consider: ${firstBullet.replace(/^-\s*/, "").trim()}`
          : `Review rule "${rule.title}" for applicability`,
      })
    }
  }

  const summary = {
    pass: results.filter((r) => r.status === "PASS").length,
    violated: results.filter((r) => r.status === "VIOLATED").length,
    notCovered: results.filter((r) => r.status === "NOT_COVERED").length,
  }

  const hasMustViolation = results.some(
    (r) => r.status === "VIOLATED" && r.modality === "must"
  )

  let status: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED"
  if (hasMustViolation) {
    status = "FAILED"
  } else if (summary.violated > 0 || summary.notCovered > 0) {
    status = "PASSED_WITH_WARNINGS"
  } else {
    status = "PASSED"
  }

  return {
    task: task ?? plan.slice(0, 100),
    rulesMatched: results.filter((r) => r.status !== "NOT_COVERED").length,
    rulesTotal: rules.length,
    results,
    summary,
    status,
  }
}
