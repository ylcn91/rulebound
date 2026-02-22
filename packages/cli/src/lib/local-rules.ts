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
  filePath: string
}

interface FrontMatter {
  title?: string
  category?: string
  severity?: string
  modality?: string
  tags?: string[]
}

function parseFrontMatter(raw: string): { meta: FrontMatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }

  const meta: FrontMatter = {}
  const lines = match[1].split("\n")

  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (!kv) continue

    const [, key, value] = kv
    if (key === "tags") {
      const tagMatch = value.match(/\[([^\]]*)\]/)
      meta.tags = tagMatch
        ? tagMatch[1].split(",").map((t) => t.trim())
        : value.split(",").map((t) => t.trim())
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
  // Check .rulebound/rules/ first, then examples/rules/
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
      filePath: relPath,
    })
  }

  return rules
}

export function filterRules(
  rules: LocalRule[],
  opts: {
    title?: string
    category?: string
    tags?: string
    task?: string
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

  if (opts.task) {
    const taskLower = opts.task.toLowerCase()
    const taskWords = taskLower.split(/\s+/).filter((w) => w.length > 3)

    filtered = filtered.filter((r) => {
      const ruleText = `${r.title} ${r.content} ${r.tags.join(" ")} ${r.category}`.toLowerCase()
      return taskWords.some((word) => ruleText.includes(word))
    })
  }

  return filtered
}

export function validatePlanAgainstRules(
  plan: string,
  rules: LocalRule[]
): {
  results: Array<{
    ruleId: string
    ruleTitle: string
    severity: string
    modality: string
    status: "PASS" | "WARN" | "FAIL"
    message: string
  }>
  summary: { total: number; pass: number; warn: number; fail: number }
} {
  const planLower = plan.toLowerCase()
  const results: Array<{
    ruleId: string
    ruleTitle: string
    severity: string
    modality: string
    status: "PASS" | "WARN" | "FAIL"
    message: string
  }> = []

  for (const rule of rules) {
    // Extract keywords from rule
    const keywords = extractKeywords(rule)
    const matchedKeywords = keywords.filter((kw) => planLower.includes(kw))
    const matchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0

    if (matchRatio === 0) {
      results.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        severity: rule.severity,
        modality: rule.modality,
        status: "PASS",
        message: "Rule not applicable to this plan.",
      })
      continue
    }

    if (matchRatio > 0.5) {
      results.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        severity: rule.severity,
        modality: rule.modality,
        status: "PASS",
        message: `Plan addresses: ${matchedKeywords.join(", ")}.`,
      })
    } else {
      const status = rule.severity === "error" && rule.modality === "must" ? "FAIL" as const : "WARN" as const
      results.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        severity: rule.severity,
        modality: rule.modality,
        status,
        message: `Plan partially covers rule. Found: ${matchedKeywords.join(", ")}. Review full rule.`,
      })
    }
  }

  return {
    results,
    summary: {
      total: results.length,
      pass: results.filter((r) => r.status === "PASS").length,
      warn: results.filter((r) => r.status === "WARN").length,
      fail: results.filter((r) => r.status === "FAIL").length,
    },
  }
}

function extractKeywords(rule: LocalRule): string[] {
  const words = new Set<string>()

  const titleWords = rule.title.toLowerCase().split(/\s+/)
  for (const word of titleWords) {
    if (word.length > 3) words.add(word)
  }

  for (const tag of rule.tags) {
    if (tag) words.add(tag.toLowerCase())
  }

  words.add(rule.category.toLowerCase())

  return [...words]
}
