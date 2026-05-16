import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { CheckResult, ScenarioCheck } from "../types.js"

interface ScenarioRunOptions {
  readonly cwd: string
  readonly ruleId: string
  readonly check: ScenarioCheck
}

interface ScenarioAssertion {
  readonly id?: unknown
  readonly status?: unknown
}

interface ScenarioReport {
  readonly scenario?: unknown
  readonly status?: unknown
  readonly environment?: {
    readonly finishedAt?: unknown
    readonly timestamp?: unknown
  }
  readonly finishedAt?: unknown
  readonly timestamp?: unknown
  readonly assertions?: unknown
}

function result(
  ruleId: string,
  checkId: string,
  check: ScenarioCheck,
  status: CheckResult["status"],
  reason: string,
): CheckResult {
  return {
    ruleId,
    checkId,
    status,
    source: "scenario",
    deterministic: true,
    confidence: "exact",
    blocking: status !== "PASS" && (check.severity ?? "error") === "error",
    reason: check.message ?? reason,
    evidence: {
      scenarioReport: check.report,
    },
  }
}

function parseReport(raw: string): ScenarioReport | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    return parsed as ScenarioReport
  } catch {
    return null
  }
}

function reportTimestamp(report: ScenarioReport): string | undefined {
  const value =
    report.environment?.finishedAt ??
    report.environment?.timestamp ??
    report.finishedAt ??
    report.timestamp
  return typeof value === "string" ? value : undefined
}

function assertionIds(report: ScenarioReport): Set<string> {
  if (!Array.isArray(report.assertions)) return new Set()
  return new Set(
    (report.assertions as readonly ScenarioAssertion[])
      .filter((assertion) => assertion.status === "passed" && typeof assertion.id === "string")
      .map((assertion) => assertion.id as string),
  )
}

export function runScenarioCheck(opts: ScenarioRunOptions): CheckResult {
  const { cwd, ruleId, check } = opts
  const checkId = check.id ?? `scenario:${check.scenario ?? check.report}`
  const reportPath = resolve(cwd, check.report)

  let raw: string
  try {
    raw = readFileSync(reportPath, "utf-8")
  } catch {
    return result(ruleId, checkId, check, "ERROR", `Scenario report not found: ${check.report}`)
  }

  const report = parseReport(raw)
  if (!report) {
    return result(ruleId, checkId, check, "ERROR", `Malformed scenario report: ${check.report}`)
  }

  if (typeof report.status !== "string") {
    return result(ruleId, checkId, check, "ERROR", "Scenario report is missing string status")
  }

  if (check.scenario !== undefined && report.scenario !== check.scenario) {
    return result(
      ruleId,
      checkId,
      check,
      "VIOLATED",
      `Scenario mismatch: expected ${check.scenario}, got ${String(report.scenario)}`,
    )
  }

  if (check.max_age_minutes !== undefined) {
    const timestamp = reportTimestamp(report)
    const millis = timestamp ? new Date(timestamp).getTime() : NaN
    if (!Number.isFinite(millis)) {
      return result(ruleId, checkId, check, "ERROR", "Scenario report timestamp is missing or invalid")
    }
    const ageMs = Date.now() - millis
    if (ageMs > check.max_age_minutes * 60_000) {
      return result(ruleId, checkId, check, "VIOLATED", `Scenario report is stale: ${check.report}`)
    }
  }

  if (check.require_assertions && check.require_assertions.length > 0) {
    const passedAssertions = assertionIds(report)
    const missing = check.require_assertions.filter((id) => !passedAssertions.has(id))
    if (missing.length > 0) {
      return result(ruleId, checkId, check, "VIOLATED", `Scenario missing passed assertion(s): ${missing.join(", ")}`)
    }
  }

  const requiredStatus = check.require_status ?? "passed"
  if (report.status !== requiredStatus) {
    return result(
      ruleId,
      checkId,
      check,
      "VIOLATED",
      `Scenario status ${report.status}; expected ${requiredStatus}`,
    )
  }

  return result(ruleId, checkId, check, "PASS", `Scenario ${check.scenario ?? check.report} satisfied`)
}
