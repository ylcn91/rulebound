import { readFileSync, readdirSync, existsSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import type { Rule, ProjectConfig, RuleboundConfig } from "./types.js"
import { logger } from "@rulebound/shared/logger"

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
      if (stat.isDirectory()) walk(full)
      else if (entry.endsWith(".md")) files.push(full)
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
    if (existsSync(dir) && statSync(dir).isDirectory()) return dir
  }
  return null
}

export function loadLocalRules(rulesDir: string): Rule[] {
  const files = collectMarkdownFiles(rulesDir)
  const rules: Rule[] = []

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

export function matchRulesByContext(
  rules: Rule[],
  projectConfig?: ProjectConfig | null,
  task?: string
): Rule[] {
  let matched: Array<{ rule: Rule; score: number }> = []

  for (const rule of rules) {
    const isGlobalScope = rule.scope.some((s) => s.toLowerCase() === "all")
    const hasMetadata =
      rule.stack.length > 0 ||
      (rule.scope.length > 0 && !isGlobalScope) ||
      rule.team.length > 0

    if (!projectConfig || !hasMetadata) {
      matched.push({ rule, score: hasMetadata ? 0 : 1 })
      continue
    }

    let score = 0

    if (rule.stack.length > 0 && projectConfig.stack) {
      const stackMatches = rule.stack.filter((s) =>
        projectConfig.stack!.map((ps) => ps.toLowerCase()).includes(s.toLowerCase())
      ).length
      score += stackMatches * 3
    }

    if (rule.scope.length > 0 && projectConfig.scope) {
      const scopeMatches = rule.scope.filter((s) =>
        projectConfig.scope!.map((ps) => ps.toLowerCase()).includes(s.toLowerCase())
      ).length
      score += scopeMatches * 2
    }

    if (rule.team.length > 0 && projectConfig.team) {
      const teamMatch = rule.team.some((t) => t.toLowerCase() === projectConfig.team!.toLowerCase())
      if (teamMatch) score += 1
    }

    if (score > 0 || !hasMetadata) {
      matched.push({ rule, score })
    }
  }

  if (task) {
    const taskLower = task.toLowerCase()
    const taskWords = taskLower.split(/\s+/).filter((w) => w.length > 3)

    if (taskWords.length > 0) {
      matched = matched.filter(({ rule }) => {
        const hasContextMatch = rule.stack.length > 0 || rule.scope.length > 0
        if (hasContextMatch) return true
        const ruleText = `${rule.title} ${rule.tags.join(" ")} ${rule.category} ${rule.stack.join(" ")}`.toLowerCase()
        return taskWords.some((word) => ruleText.includes(word))
      })
    }
  }

  matched.sort((a, b) => b.score - a.score)
  return matched.map((m) => m.rule)
}

export function filterRules(
  rules: Rule[],
  opts: { title?: string; category?: string; tags?: string; task?: string; stack?: string }
): Rule[] {
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
    const taskWords = opts.task.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    filtered = filtered.filter((r) => {
      const ruleText = `${r.title} ${r.content} ${r.tags.join(" ")} ${r.category} ${r.stack.join(" ")}`.toLowerCase()
      return taskWords.some((word) => ruleText.includes(word))
    })
  }

  return filtered
}

// --- Project stack detection ---

const PROJECT_FILE_STACK_MAP: Record<string, string[]> = {
  "pom.xml": ["java", "spring-boot"],
  "build.gradle": ["java", "spring-boot"],
  "build.gradle.kts": ["java", "spring-boot", "kotlin"],
  "go.mod": ["go"],
  "Cargo.toml": ["rust"],
  "package.json": ["typescript", "javascript"],
  "requirements.txt": ["python"],
  "pyproject.toml": ["python"],
  "Pipfile": ["python"],
  "Dockerfile": ["docker"],
  "docker-compose.yml": ["docker"],
  "docker-compose.yaml": ["docker"],
}

export function detectProjectStack(cwd: string): string[] {
  const stacks = new Set<string>()
  for (const [file, stackValues] of Object.entries(PROJECT_FILE_STACK_MAP)) {
    if (file.startsWith("*")) {
      const ext = file.slice(1)
      try {
        const entries = readdirSync(cwd)
        if (entries.some((e) => e.endsWith(ext))) {
          stackValues.forEach((s) => stacks.add(s))
        }
      } catch (error) {
        logger.debug("Failed to read directory for stack detection", {
          cwd,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } else {
      if (existsSync(join(cwd, file))) {
        stackValues.forEach((s) => stacks.add(s))
      }
    }
  }
  return [...stacks]
}

export function detectLanguageFromCode(code: string, filePath?: string): string | undefined {
  if (filePath) {
    const ext = filePath.split(".").pop()?.toLowerCase()
    const extMap: Record<string, string> = {
      java: "java", kt: "kotlin", py: "python", go: "go",
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      rs: "rust", rb: "ruby", cs: "csharp", cpp: "cpp",
    }
    if (ext && extMap[ext]) return extMap[ext]
  }

  if (code.includes("public class") || code.includes("@Service") || code.includes("@Autowired")) return "java"
  if (code.includes("func ") && code.includes("package ")) return "go"
  if (code.includes("def ") && (code.includes("import ") || code.includes("self"))) return "python"
  if (code.includes("interface ") || code.includes("const ") || code.includes(": string")) return "typescript"
  if (code.includes("FROM ") && code.includes("RUN ")) return "dockerfile"
  if (code.includes("namespace ") && code.includes("using ")) return "csharp"
  return undefined
}

// --- Config loading ---

export function loadConfig(cwd: string): RuleboundConfig | null {
  const configPath = resolve(cwd, ".rulebound", "config.json")
  if (!existsSync(configPath)) return null
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as RuleboundConfig
  } catch (error) {
    logger.warn("Failed to parse rulebound config", {
      configPath,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export function getProjectConfig(cwd: string): ProjectConfig | null {
  const config = loadConfig(cwd)
  if (!config?.project) return null

  const { name, stack, scope, team } = config.project
  const hasValues =
    (name != null && name !== "") ||
    (stack != null && stack.length > 0) ||
    (scope != null && scope.length > 0) ||
    (team != null && team !== "")

  if (!hasValues) {
    const detectedStack = detectProjectStack(cwd)
    if (detectedStack.length > 0) {
      return { stack: detectedStack }
    }
    return null
  }

  return { name, stack, scope, team }
}

export function loadRulesWithInheritance(cwd: string, overrideDir?: string): Rule[] {
  const config = loadConfig(cwd)
  const baseRules: Map<string, Rule> = new Map()

  if (config?.extends) {
    for (const extendPath of config.extends) {
      const resolvedPath = resolveExtendPath(cwd, extendPath)
      if (resolvedPath && existsSync(resolvedPath)) {
        const extRules = loadLocalRules(resolvedPath)
        for (const rule of extRules) {
          baseRules.set(rule.id, { ...rule, filePath: `[inherited] ${rule.filePath}` })
        }
      }
    }
  }

  const localDir = overrideDir ?? findRulesDir(cwd)
  if (localDir) {
    const localRules = loadLocalRules(localDir)
    for (const rule of localRules) {
      baseRules.set(rule.id, rule)
    }
  }

  return [...baseRules.values()]
}

function resolveExtendPath(cwd: string, extendPath: string): string | null {
  if (extendPath.startsWith(".") || extendPath.startsWith("/")) {
    return resolve(cwd, extendPath)
  }

  const nmPath = resolve(cwd, "node_modules", extendPath, "rules")
  if (existsSync(nmPath)) return nmPath

  const nmRuleboundPath = resolve(cwd, "node_modules", extendPath, ".rulebound", "rules")
  if (existsSync(nmRuleboundPath)) return nmRuleboundPath

  return null
}
