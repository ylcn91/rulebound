// Canonical DeterministicReport schema module.
//
// This module is the single re-export surface for the public report contract.
// Types remain defined in their existing homes (see ./checks/deterministic.ts,
// ./checks/types.ts, ./checks/waivers.ts) — this module imports and re-exports
// them so downstream consumers have one stable import path.
//
// SCHEMA_VERSION is a doc-only constant: it is NOT emitted in runtime output
// today. Callers may stamp it onto stored snapshots if they need version
// metadata. validateDeterministic()'s return value is unchanged.

import type {
  DeterministicReport,
  RuleStatus,
} from "./checks/deterministic.js"
import type {
  CheckResult,
  CheckEvidence,
  DeterministicSource,
  ConfidenceLevel,
} from "./checks/types.js"
import type { Waiver, AppliedWaiver } from "./checks/waivers.js"

export type {
  DeterministicReport,
  RuleStatus,
  CheckResult,
  CheckEvidence,
  DeterministicSource,
  ConfidenceLevel,
  Waiver,
  AppliedWaiver,
}

export interface ReportParseError {
  readonly ruleId: string
  readonly errors: readonly string[]
}

export const SCHEMA_VERSION = "1.0.0" as const

const REPORT_STATUS_VALUES = ["PASSED", "FAILED", "PASSED_WITH_WARNINGS"] as const
const CHECK_STATUS_VALUES = ["PASS", "VIOLATED", "NOT_APPLICABLE", "ERROR"] as const
const RULE_STATUS_VALUES = ["PASS", "VIOLATED", "NOT_APPLICABLE", "ERROR", "ADVISORY"] as const
const SOURCE_VALUES = [
  "ast",
  "regex",
  "diff",
  "file",
  "import-boundary",
  "command",
  "analyzer",
  "agent-process",
  "keyword",
  "semantic",
  "llm",
] as const
const SUMMARY_NUMERIC_FIELDS = ["total", "pass", "violated", "notApplicable", "error", "blocking", "waived"] as const

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function fail(path: string, expected: string, got: unknown): never {
  const repr =
    got === null
      ? "null"
      : Array.isArray(got)
        ? "array"
        : typeof got === "object"
          ? "object"
          : JSON.stringify(got)
  throw new Error(`Invalid DeterministicReport at ${path}: expected ${expected}, got ${repr}`)
}

function validateEnum(path: string, value: unknown, allowed: readonly string[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) {
    fail(path, `one of [${allowed.join(",")}]`, value)
  }
}

function validateString(path: string, value: unknown): void {
  if (typeof value !== "string") fail(path, "string", value)
}

function validateBoolean(path: string, value: unknown): void {
  if (typeof value !== "boolean") fail(path, "boolean", value)
}

function validateNumber(path: string, value: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "number", value)
}

function validateArray(path: string, value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) fail(path, "array", value)
  return value
}

function validateSummary(value: unknown): void {
  if (!isObject(value)) fail("/summary", "object", value)
  for (const key of SUMMARY_NUMERIC_FIELDS) {
    validateNumber(`/summary/${key}`, value[key])
  }
}

function validateEvidence(path: string, value: unknown): void {
  if (!isObject(value)) fail(path, "object", value)
  validateString(`${path}/filePath`, value.filePath)
}

function validateCheckResult(path: string, value: unknown): void {
  if (!isObject(value)) fail(path, "object", value)
  validateString(`${path}/ruleId`, value.ruleId)
  validateEnum(`${path}/status`, value.status, CHECK_STATUS_VALUES)
  validateEnum(`${path}/source`, value.source, SOURCE_VALUES)
  validateBoolean(`${path}/deterministic`, value.deterministic)
  if (value.evidence !== undefined) {
    validateEvidence(`${path}/evidence`, value.evidence)
  }
}

function validateRuleStatus(path: string, value: unknown): void {
  if (!isObject(value)) fail(path, "object", value)
  validateString(`${path}/ruleId`, value.ruleId)
  validateString(`${path}/title`, value.title)
  validateNumber(`${path}/checkCount`, value.checkCount)
  validateEnum(`${path}/status`, value.status, RULE_STATUS_VALUES)
  validateBoolean(`${path}/blocking`, value.blocking)
}

function validateParseError(path: string, value: unknown): void {
  if (!isObject(value)) fail(path, "object", value)
  validateString(`${path}/ruleId`, value.ruleId)
  const errors = validateArray(`${path}/errors`, value.errors)
  errors.forEach((msg, i) => validateString(`${path}/errors/${i}`, msg))
}

function validateWaiverShape(path: string, value: unknown): void {
  if (!isObject(value)) fail(path, "object", value)
  validateString(`${path}/rule`, value.rule)
  validateString(`${path}/reason`, value.reason)
  validateString(`${path}/owner`, value.owner)
  validateString(`${path}/expires`, value.expires)
  if (value.check !== undefined) validateString(`${path}/check`, value.check)
  if (value.scope !== undefined) {
    const scope = validateArray(`${path}/scope`, value.scope)
    scope.forEach((s, i) => validateString(`${path}/scope/${i}`, s))
  }
}

function validateAppliedWaiver(path: string, value: unknown): void {
  if (!isObject(value)) fail(path, "object", value)
  validateWaiverShape(`${path}/waiver`, value.waiver)
  if (value.expired !== undefined) validateBoolean(`${path}/expired`, value.expired)
}

export function validateDeterministicReport(input: unknown): DeterministicReport {
  if (!isObject(input)) fail("", "object", input)
  validateEnum("/status", input.status, REPORT_STATUS_VALUES)
  validateSummary(input.summary)

  const results = validateArray("/results", input.results)
  results.forEach((r, i) => validateCheckResult(`/results/${i}`, r))

  const ruleStatuses = validateArray("/ruleStatuses", input.ruleStatuses)
  ruleStatuses.forEach((r, i) => validateRuleStatus(`/ruleStatuses/${i}`, r))

  const parseErrors = validateArray("/parseErrors", input.parseErrors)
  parseErrors.forEach((e, i) => validateParseError(`/parseErrors/${i}`, e))

  const waiversApplied = validateArray("/waiversApplied", input.waiversApplied)
  waiversApplied.forEach((w, i) => validateAppliedWaiver(`/waiversApplied/${i}`, w))

  return input as unknown as DeterministicReport
}
