import { readFileSync, statSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import type { CheckResult } from "../types.js"
import type { RegexCheck } from "../types.js"

export interface RegexRunOptions {
  readonly cwd: string
  readonly ruleId: string
  readonly check: RegexCheck
  readonly fileAllowList?: readonly string[]
}

function matchesGlob(pathRel: string, pattern: string): boolean {
  const re = globToRegex(pattern)
  return re.test(pathRel)
}

export function globToRegex(pattern: string): RegExp {
  let re = ""
  let i = 0
  while (i < pattern.length) {
    const c = pattern[i]
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        re += ".*"
        i += 2
        if (pattern[i] === "/") i += 1
        continue
      }
      re += "[^/]*"
    } else if (c === "?") {
      re += "[^/]"
    } else if (".+^$()|{}[]\\".includes(c)) {
      re += "\\" + c
    } else if (c === "/") {
      re += "/"
    } else {
      re += c
    }
    i += 1
  }
  return new RegExp(`^${re}$`)
}

const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".next",
  ".turbo",
  "build",
  "out",
  "target",
  "coverage",
])

function walk(dir: string, root: string, files: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (DEFAULT_IGNORE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      walk(full, root, files)
    } else if (stat.isFile()) {
      files.push(relative(root, full))
    }
  }
}

export function listFiles(cwd: string, patterns: readonly string[] | undefined): string[] {
  const all: string[] = []
  walk(cwd, cwd, all)
  if (!patterns || patterns.length === 0) return all
  return all.filter((f) => patterns.some((p) => matchesGlob(f, p)))
}

export function runRegexCheck(opts: RegexRunOptions): readonly CheckResult[] {
  const { cwd, ruleId, check, fileAllowList } = opts
  const results: CheckResult[] = []
  const checkId = check.id ?? `regex:${check.pattern}`
  let regex: RegExp
  try {
    regex = new RegExp(check.pattern, check.flags ?? "g")
  } catch (error) {
    return [
      {
        ruleId,
        checkId,
        status: "ERROR",
        source: "regex",
        deterministic: true,
        confidence: "exact",
        blocking: false,
        reason: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
      },
    ]
  }

  const filePatterns = check.files ?? fileAllowList ?? ["**/*"]
  const files = listFiles(cwd, filePatterns)
  const forbidden = check.forbidden ?? !check.require

  let matchedAnyFile = false

  for (const rel of files) {
    let content: string
    try {
      content = readFileSync(join(cwd, rel), "utf-8")
    } catch {
      continue
    }
    const localRegex = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g")
    const found: { line: number; snippet: string }[] = []
    let m: RegExpExecArray | null
    while ((m = localRegex.exec(content)) !== null) {
      const before = content.slice(0, m.index)
      const line = before.split("\n").length
      const snippet = content.split("\n")[line - 1]?.slice(0, 200) ?? ""
      found.push({ line, snippet })
      if (m.index === localRegex.lastIndex) localRegex.lastIndex += 1
    }
    if (found.length > 0) {
      matchedAnyFile = true
      if (forbidden) {
        for (const hit of found) {
          results.push({
            ruleId,
            checkId,
            status: "VIOLATED",
            source: "regex",
            deterministic: true,
            confidence: "exact",
            blocking: (check.severity ?? "error") === "error",
            reason: check.message ?? `Forbidden pattern matched: /${check.pattern}/`,
            evidence: { filePath: rel, line: hit.line, snippet: hit.snippet },
            ...(check.description ? { suggestedFix: check.description } : {}),
          })
        }
      }
    }
  }

  if (check.require && !matchedAnyFile) {
    results.push({
      ruleId,
      checkId,
      status: "VIOLATED",
      source: "regex",
      deterministic: true,
      confidence: "exact",
      blocking: (check.severity ?? "error") === "error",
      reason: check.message ?? `Required pattern never matched: /${check.pattern}/`,
    })
  }

  if (results.length === 0) {
    results.push({
      ruleId,
      checkId,
      status: "PASS",
      source: "regex",
      deterministic: true,
      confidence: "exact",
      blocking: false,
      reason: forbidden
        ? `Forbidden pattern not found across ${files.length} files`
        : `Required pattern present`,
    })
  }
  return results
}

export const SECRET_PATTERNS: readonly RegexCheck[] = [
  {
    type: "regex",
    id: "secret:aws-access-key",
    pattern: "AKIA[0-9A-Z]{16}",
    severity: "error",
    forbidden: true,
    message: "Potential AWS access key ID committed",
  },
  {
    type: "regex",
    id: "secret:private-key-block",
    pattern: "-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----",
    severity: "error",
    forbidden: true,
    message: "Private key block committed",
  },
  {
    type: "regex",
    id: "secret:generic-api-key",
    pattern: "(?i)(api[_-]?key|secret|token)\\s*[:=]\\s*['\"][A-Za-z0-9_\\-]{16,}['\"]",
    severity: "warning",
    forbidden: true,
    message: "Hardcoded credential-like assignment detected",
  },
]
