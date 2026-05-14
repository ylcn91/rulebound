import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { globToRegex } from "./runners/regex.js"
import type { CheckResult } from "./types.js"

export interface Waiver {
  readonly rule: string
  readonly check?: string
  readonly reason: string
  readonly owner: string
  readonly expires: string
  readonly scope?: readonly string[]
}

export interface AppliedWaiver {
  readonly result: CheckResult
  readonly waiver: Waiver
  readonly expired: boolean
}

export interface WaiverLoadError {
  readonly path: string
  readonly index?: number
  readonly message: string
}

export interface WaiverLoadResult {
  readonly waivers: readonly Waiver[]
  readonly errors: readonly WaiverLoadError[]
  readonly path: string
}

interface WaiverYaml {
  readonly waivers?: readonly unknown[]
}

const DEFAULT_PATH = ".rulebound/waivers.yaml"

export function loadWaiversWithErrors(cwd: string, file?: string): WaiverLoadResult {
  const path = file ? resolve(cwd, file) : resolve(cwd, DEFAULT_PATH)
  const errors: WaiverLoadError[] = []
  if (!existsSync(path)) {
    if (file) {
      errors.push({ path, message: "Waivers file not found" })
    }
    return { waivers: [], errors, path }
  }

  let raw: string
  try {
    raw = readFileSync(path, "utf-8")
  } catch (error) {
    errors.push({ path, message: `Failed to read waivers file: ${error instanceof Error ? error.message : String(error)}` })
    return { waivers: [], errors, path }
  }

  let root: WaiverYaml
  try {
    root = parseYamlObject(raw) as WaiverYaml
  } catch (error) {
    errors.push({ path, message: `YAML parse error: ${error instanceof Error ? error.message : String(error)}` })
    return { waivers: [], errors, path }
  }

  const list = root.waivers
  if (list === undefined) {
    errors.push({ path, message: "Top-level 'waivers' key is missing" })
    return { waivers: [], errors, path }
  }
  if (!Array.isArray(list)) {
    errors.push({ path, message: "'waivers' must be an array" })
    return { waivers: [], errors, path }
  }

  const waivers: Waiver[] = []
  list.forEach((entry, index) => {
    const validation = validateWaiver(entry, index)
    if (validation.ok) {
      waivers.push(validation.waiver)
    } else {
      errors.push(...validation.errors.map((message) => ({ path, index, message })))
    }
  })

  return { waivers, errors, path }
}

export function loadWaivers(cwd: string, file?: string): readonly Waiver[] {
  return loadWaiversWithErrors(cwd, file).waivers
}

interface WaiverValidationOk {
  readonly ok: true
  readonly waiver: Waiver
}

interface WaiverValidationFail {
  readonly ok: false
  readonly errors: readonly string[]
}

function validateWaiver(raw: unknown, index: number): WaiverValidationOk | WaiverValidationFail {
  const errs: string[] = []
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: [`waivers[${index}]: must be an object`] }
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.rule !== "string" || obj.rule.trim() === "") {
    errs.push(`waivers[${index}]: 'rule' (non-empty string) is required`)
  }
  if (typeof obj.reason !== "string" || obj.reason.trim() === "") {
    errs.push(`waivers[${index}]: 'reason' (non-empty string) is required`)
  }
  if (typeof obj.owner !== "string" || obj.owner.trim() === "") {
    errs.push(
      `waivers[${index}]: 'owner' (non-empty string) is required — every waiver must name an accountable owner`,
    )
  }
  if (typeof obj.expires !== "string" || obj.expires.trim() === "") {
    errs.push(
      `waivers[${index}]: 'expires' (ISO date string) is required — waivers must be time-boxed`,
    )
  } else if (Number.isNaN(new Date(obj.expires).getTime())) {
    errs.push(`waivers[${index}]: 'expires' is not a parseable date: ${JSON.stringify(obj.expires)}`)
  }
  if (obj.check !== undefined && typeof obj.check !== "string") {
    errs.push(`waivers[${index}]: 'check' must be a string when present`)
  }

  const scopeFromPath = normalizePathField(obj.path)
  if (scopeFromPath instanceof Error) {
    errs.push(`waivers[${index}]: ${scopeFromPath.message}`)
  }
  if (obj.scope !== undefined) {
    if (!Array.isArray(obj.scope) || obj.scope.some((s) => typeof s !== "string")) {
      errs.push(`waivers[${index}]: 'scope' must be an array of strings when present`)
    }
  }

  if (errs.length > 0) return { ok: false, errors: errs }

  const baseScope = Array.isArray(obj.scope) ? (obj.scope as readonly string[]) : undefined
  const mergedScope =
    scopeFromPath instanceof Error || !scopeFromPath
      ? baseScope
      : baseScope
        ? [...baseScope, ...scopeFromPath]
        : scopeFromPath

  return {
    ok: true,
    waiver: {
      rule: obj.rule as string,
      reason: obj.reason as string,
      owner: obj.owner as string,
      expires: obj.expires as string,
      ...(obj.check ? { check: obj.check as string } : {}),
      ...(mergedScope ? { scope: mergedScope } : {}),
    },
  }
}

function normalizePathField(value: unknown): readonly string[] | undefined | Error {
  if (value === undefined) return undefined
  if (typeof value === "string") return [value]
  if (Array.isArray(value) && value.every((s) => typeof s === "string")) return value as readonly string[]
  return new Error("'path' must be a string or string[] when present")
}

function parseYamlObject(text: string): Record<string, unknown> {
  const lines = text.split("\n")
  const result: Record<string, unknown> = {}
  let listItems: Record<string, unknown>[] | null = null
  let currentItem: Record<string, unknown> | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === "" || line.trim().startsWith("#")) continue
    const indent = line.length - line.trimStart().length
    const trimmed = line.trim()

    if (indent === 0 && /^[\w-]+:/.test(trimmed)) {
      const colon = trimmed.indexOf(":")
      const key = trimmed.slice(0, colon).trim()
      const rest = trimmed.slice(colon + 1).trim()
      if (rest === "") {
        listItems = []
        result[key] = listItems
      } else {
        result[key] = stripQuotes(rest)
        listItems = null
      }
      currentItem = null
      continue
    }

    if (indent >= 2 && trimmed.startsWith("- ") && listItems) {
      currentItem = {}
      listItems.push(currentItem)
      const after = trimmed.slice(2).trim()
      if (/^[\w-]+:/.test(after)) {
        const colon = after.indexOf(":")
        const k = after.slice(0, colon).trim()
        const v = after.slice(colon + 1).trim()
        if (v === "") {
          currentItem[k] = []
        } else {
          currentItem[k] = stripQuotes(v)
        }
      }
      continue
    }

    if (indent >= 4 && currentItem && /^[\w-]+:/.test(trimmed)) {
      const colon = trimmed.indexOf(":")
      const k = trimmed.slice(0, colon).trim()
      const v = trimmed.slice(colon + 1).trim()
      if (v === "") {
        currentItem[k] = []
      } else if (v.startsWith("[") && v.endsWith("]")) {
        currentItem[k] = v
          .slice(1, -1)
          .split(",")
          .map((s) => stripQuotes(s.trim()))
          .filter(Boolean)
      } else {
        currentItem[k] = stripQuotes(v)
      }
      continue
    }

    if (indent >= 6 && trimmed.startsWith("- ") && currentItem) {
      const lastKey = Object.keys(currentItem).pop()
      if (lastKey && Array.isArray(currentItem[lastKey])) {
        ;(currentItem[lastKey] as string[]).push(stripQuotes(trimmed.slice(2).trim()))
      }
    }
  }

  return result
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "")
}

function isExpired(waiver: Waiver, now: Date): boolean {
  if (!waiver.expires) return false
  const exp = new Date(waiver.expires)
  if (Number.isNaN(exp.getTime())) return true // fail-closed: unparseable expiry is treated as expired
  return exp.getTime() < now.getTime()
}

function inScope(result: CheckResult, waiver: Waiver): boolean {
  if (!waiver.scope || waiver.scope.length === 0) return true
  const file = result.evidence?.filePath
  if (!file) return false // fail-closed: scoped waiver requires a file-pinned finding
  const regs = waiver.scope.map((s) => globToRegex(s))
  return regs.some((r) => r.test(file))
}

export interface WaiverApplication {
  readonly results: readonly CheckResult[]
  readonly applied: readonly AppliedWaiver[]
}

export function applyWaivers(
  results: readonly CheckResult[],
  waivers: readonly Waiver[],
  now: Date = new Date(),
): WaiverApplication {
  if (waivers.length === 0) return { results, applied: [] }
  const applied: AppliedWaiver[] = []
  const next = results.map((r) => {
    if (r.status !== "VIOLATED" && r.status !== "ERROR") return r
    const match = waivers.find(
      (w) =>
        w.rule === r.ruleId &&
        (!w.check || w.check === r.checkId) &&
        inScope(r, w),
    )
    if (!match) return r
    const expired = isExpired(match, now)
    applied.push({ result: r, waiver: match, expired })
    if (expired) return r
    return {
      ...r,
      blocking: false,
      reason: `${r.reason} [waived: ${match.reason}${match.expires ? ` until ${match.expires}` : ""}]`,
      waived: { reason: match.reason, ...(match.expires ? { expires: match.expires } : {}) },
    }
  })
  return { results: next, applied }
}
