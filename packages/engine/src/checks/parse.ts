import type { RuleCheck, CheckType } from "./types.js"
import { ALL_CHECK_TYPES } from "./types.js"

export interface ParsedChecksResult {
  readonly checks: readonly RuleCheck[]
  readonly errors: readonly string[]
}

interface YamlNode {
  [key: string]: unknown
}

function isCheckType(value: unknown): value is CheckType {
  return typeof value === "string" && (ALL_CHECK_TYPES as readonly string[]).includes(value)
}

function parseSimpleYaml(text: string): unknown {
  const lines = text.split("\n")
  const root: unknown = parseValue(lines, 0, 0).value
  return root
}

interface ParseState {
  readonly value: unknown
  readonly nextIndex: number
}

function detectIndent(line: string): number {
  let i = 0
  while (i < line.length && line[i] === " ") i += 1
  return i
}

function isBlankOrComment(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === "" || trimmed.startsWith("#")
}

function parseScalar(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === "") return ""
  if (trimmed === "true") return true
  if (trimmed === "false") return false
  if (trimmed === "null" || trimmed === "~") return null
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed)
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number(trimmed)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim()
    if (inner === "") return []
    return inner.split(",").map((part) => parseScalar(part.trim()))
  }
  return trimmed
}

function parseValue(lines: string[], startIndex: number, parentIndent: number): ParseState {
  let i = startIndex
  while (i < lines.length && isBlankOrComment(lines[i])) i += 1
  if (i >= lines.length) return { value: null, nextIndex: i }

  const firstLine = lines[i]
  const indent = detectIndent(firstLine)
  if (indent < parentIndent) return { value: null, nextIndex: i }

  const trimmed = firstLine.slice(indent)

  if (trimmed.startsWith("- ") || trimmed === "-") {
    return parseList(lines, i, indent)
  }
  if (/^[\w-]+:/.test(trimmed)) {
    return parseMapping(lines, i, indent)
  }
  return { value: parseScalar(trimmed), nextIndex: i + 1 }
}

function parseList(lines: string[], startIndex: number, indent: number): ParseState {
  const items: unknown[] = []
  let i = startIndex
  while (i < lines.length) {
    if (isBlankOrComment(lines[i])) {
      i += 1
      continue
    }
    const cur = lines[i]
    const curIndent = detectIndent(cur)
    if (curIndent < indent) break
    if (curIndent !== indent) break
    const content = cur.slice(indent)
    if (!content.startsWith("-")) break

    const afterDash = content.slice(1).trimStart()
    i += 1

    if (afterDash === "") {
      const childIndent = indent + 2
      const child = parseValue(lines, i, childIndent)
      items.push(child.value)
      i = child.nextIndex
      continue
    }

    if (/^[\w-]+:/.test(afterDash)) {
      const obj: YamlNode = {}
      const colonIdx = afterDash.indexOf(":")
      const key = afterDash.slice(0, colonIdx).trim()
      const rest = afterDash.slice(colonIdx + 1).trim()
      const childIndent = indent + 2
      if (rest === "") {
        const sub = parseValue(lines, i, childIndent + 1)
        obj[key] = sub.value
        i = sub.nextIndex
      } else {
        obj[key] = parseScalar(rest)
      }
      while (i < lines.length) {
        if (isBlankOrComment(lines[i])) {
          i += 1
          continue
        }
        const nextLine = lines[i]
        const nextIndent = detectIndent(nextLine)
        if (nextIndent < childIndent) break
        if (nextIndent === indent && nextLine.slice(indent).startsWith("-")) break
        const remainder = nextLine.slice(nextIndent)
        if (!/^[\w-]+:/.test(remainder)) break
        const subColon = remainder.indexOf(":")
        const subKey = remainder.slice(0, subColon).trim()
        const subRest = remainder.slice(subColon + 1).trim()
        i += 1
        if (subRest === "") {
          const childVal = parseValue(lines, i, nextIndent + 1)
          obj[subKey] = childVal.value
          i = childVal.nextIndex
        } else {
          obj[subKey] = parseScalar(subRest)
        }
      }
      items.push(obj)
      continue
    }

    items.push(parseScalar(afterDash))
  }
  return { value: items, nextIndex: i }
}

function parseMapping(lines: string[], startIndex: number, indent: number): ParseState {
  const obj: YamlNode = {}
  let i = startIndex
  while (i < lines.length) {
    if (isBlankOrComment(lines[i])) {
      i += 1
      continue
    }
    const cur = lines[i]
    const curIndent = detectIndent(cur)
    if (curIndent < indent) break
    if (curIndent !== indent) break
    const content = cur.slice(indent)
    if (!/^[\w-]+:/.test(content)) break

    const colonIdx = content.indexOf(":")
    const key = content.slice(0, colonIdx).trim()
    const rest = content.slice(colonIdx + 1).trim()
    i += 1

    if (rest === "") {
      const child = parseValue(lines, i, indent + 1)
      obj[key] = child.value
      i = child.nextIndex
    } else {
      obj[key] = parseScalar(rest)
    }
  }
  return { value: obj, nextIndex: i }
}

export function parseChecksYaml(yamlBlock: string): ParsedChecksResult {
  const errors: string[] = []
  let parsed: unknown
  try {
    parsed = parseSimpleYaml(yamlBlock)
  } catch (error) {
    errors.push(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`)
    return { checks: [], errors }
  }

  const root = parsed as Record<string, unknown> | null
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return { checks: [], errors }
  }

  const rawChecks = root.checks
  if (rawChecks === undefined) return { checks: [], errors }
  if (!Array.isArray(rawChecks)) {
    errors.push("'checks' must be an array")
    return { checks: [], errors }
  }

  const checks: RuleCheck[] = []
  rawChecks.forEach((entry, idx) => {
    const validation = validateCheck(entry, idx)
    if (validation.ok) {
      checks.push(validation.check)
    } else {
      errors.push(...validation.errors)
    }
  })

  return { checks, errors }
}

interface ValidationOk {
  readonly ok: true
  readonly check: RuleCheck
}

interface ValidationFail {
  readonly ok: false
  readonly errors: readonly string[]
}

function validateCheck(raw: unknown, idx: number): ValidationOk | ValidationFail {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: [`checks[${idx}]: must be an object`] }
  }
  const obj = raw as Record<string, unknown>
  const type = obj.type
  if (!isCheckType(type)) {
    return {
      ok: false,
      errors: [`checks[${idx}]: 'type' must be one of ${ALL_CHECK_TYPES.join(", ")} (got ${JSON.stringify(type)})`],
    }
  }
  switch (type) {
    case "ast":
      if (typeof obj.language !== "string") return fail(idx, "ast", "'language' (string) is required")
      if (obj.builtin !== undefined && typeof obj.builtin !== "string") return fail(idx, "ast", "'builtin' must be string")
      if (obj.query !== undefined && typeof obj.query !== "string") return fail(idx, "ast", "'query' must be string")
      break
    case "regex":
      if (typeof obj.pattern !== "string") return fail(idx, "regex", "'pattern' (string) is required")
      break
    case "file-exists":
    case "file-not-exists":
      if (typeof obj.path !== "string") return fail(idx, type, "'path' (string) is required")
      break
    case "diff-evidence":
      if (
        !Array.isArray(obj.when_changed) &&
        !Array.isArray(obj.require_changed) &&
        !Array.isArray(obj.require_not_changed) &&
        !obj.branch_matches
      ) {
        return fail(
          idx,
          "diff-evidence",
          "at least one of when_changed/require_changed/require_not_changed/branch_matches is required",
        )
      }
      break
    case "forbidden-import":
      if (!Array.isArray(obj.from) || !Array.isArray(obj.importing)) {
        return fail(idx, "forbidden-import", "'from' and 'importing' (array<string>) are required")
      }
      break
    case "command":
      if (typeof obj.run !== "string") return fail(idx, "command", "'run' (string) is required")
      break
    case "analyzer":
      if (typeof obj.analyzer !== "string") return fail(idx, "analyzer", "'analyzer' is required")
      if (typeof obj.report !== "string") return fail(idx, "analyzer", "'report' (path) is required")
      break
    case "scenario":
      if (typeof obj.report !== "string") return fail(idx, "scenario", "'report' (path) is required")
      if (obj.scenario !== undefined && typeof obj.scenario !== "string") return fail(idx, "scenario", "'scenario' must be string")
      if (
        obj.require_status !== undefined &&
        obj.require_status !== "passed" &&
        obj.require_status !== "failed" &&
        obj.require_status !== "error"
      ) {
        return fail(idx, "scenario", "'require_status' must be passed, failed, or error")
      }
      if (obj.max_age_minutes !== undefined && typeof obj.max_age_minutes !== "number") {
        return fail(idx, "scenario", "'max_age_minutes' must be number")
      }
      if (obj.require_assertions !== undefined && !Array.isArray(obj.require_assertions)) {
        return fail(idx, "scenario", "'require_assertions' must be array<string>")
      }
      break
    case "agent-process":
      if (typeof obj.require !== "string") return fail(idx, "agent-process", "'require' is required")
      break
  }
  return { ok: true, check: obj as unknown as RuleCheck }
}

function fail(idx: number, type: string, message: string): ValidationFail {
  return { ok: false, errors: [`checks[${idx}] (type=${type}): ${message}`] }
}

const FENCE_RE = /```rulebound\s*\n([\s\S]*?)```/g

export function extractFencedChecks(body: string): ParsedChecksResult {
  const errors: string[] = []
  const checks: RuleCheck[] = []
  let match
  while ((match = FENCE_RE.exec(body)) !== null) {
    const block = match[1]
    const result = parseChecksYaml(block)
    checks.push(...result.checks)
    errors.push(...result.errors)
  }
  return { checks, errors }
}

export function parseRuleChecks(frontmatterRaw: string, body: string): ParsedChecksResult {
  const errors: string[] = []
  const checks: RuleCheck[] = []

  if (frontmatterRaw.trim() !== "") {
    const fm = parseChecksYaml(frontmatterRaw)
    checks.push(...fm.checks)
    errors.push(...fm.errors)
  }

  const fenced = extractFencedChecks(body)
  checks.push(...fenced.checks)
  errors.push(...fenced.errors)

  return { checks, errors }
}
