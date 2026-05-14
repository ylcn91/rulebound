import type { Rule, EnforcementMode } from "../types.js"
import type { CheckResult, RuleCheck } from "./types.js"
import { runRegexCheck } from "./runners/regex.js"
import { runFileCheck } from "./runners/file.js"
import { runDiffCheck } from "./runners/diff.js"
import { runImportBoundaryCheck } from "./runners/import.js"
import { runCommandCheck } from "./runners/command.js"
import { runAnalyzerCheck } from "./runners/analyzer.js"
import { runAstCheck } from "./runners/ast.js"
import { applyWaivers } from "./waivers.js"
import type { Waiver, AppliedWaiver } from "./waivers.js"

export interface DeterministicValidateOptions {
  readonly cwd: string
  readonly rules: readonly Rule[]
  readonly changedFiles?: readonly string[]
  readonly branch?: string
  readonly mode?: EnforcementMode
  readonly allowCommandExecution?: boolean
  readonly agentSignals?: AgentSignals
  readonly waivers?: readonly Waiver[]
}

export interface AgentSignals {
  readonly findRulesCalled?: boolean
  readonly validatePlanCalled?: boolean
  readonly bugfixSpecPath?: string
  readonly regressionTestAdded?: boolean
}

export interface DeterministicReport {
  readonly results: readonly CheckResult[]
  readonly summary: {
    readonly total: number
    readonly pass: number
    readonly violated: number
    readonly notApplicable: number
    readonly error: number
    readonly blocking: number
    readonly waived: number
  }
  readonly status: "PASSED" | "FAILED" | "PASSED_WITH_WARNINGS"
  readonly ruleStatuses: readonly RuleStatus[]
  readonly parseErrors: readonly { ruleId: string; errors: readonly string[] }[]
  readonly waiversApplied: readonly AppliedWaiver[]
}

export interface RuleStatus {
  readonly ruleId: string
  readonly title: string
  readonly checkCount: number
  readonly status: "PASS" | "VIOLATED" | "NOT_APPLICABLE" | "ERROR" | "ADVISORY"
  readonly blocking: boolean
}

function runAgentProcessCheck(
  ruleId: string,
  check: Extract<RuleCheck, { type: "agent-process" }>,
  signals?: AgentSignals,
): CheckResult {
  const checkId = check.id ?? `agent-process:${check.require}`
  const severity = check.severity ?? "warning"
  const evaluate = (): boolean => {
    switch (check.require) {
      case "find_rules_called":
        return signals?.findRulesCalled === true
      case "validate_plan_called":
        return signals?.validatePlanCalled === true
      case "bugfix_spec_present":
        return Boolean(signals?.bugfixSpecPath)
      case "regression_test_added":
        return signals?.regressionTestAdded === true
    }
  }
  const ok = evaluate()
  return {
    ruleId,
    checkId,
    status: ok ? "PASS" : "VIOLATED",
    source: "agent-process",
    deterministic: true,
    confidence: ok ? "exact" : "high",
    blocking: !ok && severity === "error",
    reason: ok
      ? `Agent signal '${check.require}' satisfied`
      : check.message ?? `Required agent signal missing: ${check.require}`,
  }
}

async function runCheck(
  rule: Rule,
  check: RuleCheck,
  opts: DeterministicValidateOptions,
): Promise<readonly CheckResult[]> {
  const allowCmds = opts.allowCommandExecution ?? false
  switch (check.type) {
    case "regex":
      return runRegexCheck({ cwd: opts.cwd, ruleId: rule.id, check })
    case "file-exists":
    case "file-not-exists":
      return [runFileCheck({ cwd: opts.cwd, ruleId: rule.id, check })]
    case "diff-evidence":
      return [
        runDiffCheck({
          ruleId: rule.id,
          check,
          changedFiles: opts.changedFiles ?? [],
          ...(opts.branch !== undefined ? { branch: opts.branch } : {}),
        }),
      ]
    case "forbidden-import":
      return runImportBoundaryCheck({ cwd: opts.cwd, ruleId: rule.id, check })
    case "command":
      return [runCommandCheck({ cwd: opts.cwd, ruleId: rule.id, check, allowCommandExecution: allowCmds })]
    case "analyzer":
      return [runAnalyzerCheck({ cwd: opts.cwd, ruleId: rule.id, check, allowCommandExecution: allowCmds })]
    case "ast":
      return runAstCheck({ cwd: opts.cwd, ruleId: rule.id, check })
    case "agent-process":
      return [runAgentProcessCheck(rule.id, check, opts.agentSignals)]
  }
}

function summarize(results: readonly CheckResult[], waived: number) {
  const summary = { total: results.length, pass: 0, violated: 0, notApplicable: 0, error: 0, blocking: 0, waived }
  for (const r of results) {
    if (r.status === "PASS") summary.pass += 1
    else if (r.status === "VIOLATED") summary.violated += 1
    else if (r.status === "NOT_APPLICABLE") summary.notApplicable += 1
    else if (r.status === "ERROR") summary.error += 1
    if (r.blocking) summary.blocking += 1
  }
  return summary
}

function aggregateRuleStatuses(rules: readonly Rule[], results: readonly CheckResult[]): RuleStatus[] {
  const byRule = new Map<string, CheckResult[]>()
  for (const r of results) {
    const list = byRule.get(r.ruleId) ?? []
    list.push(r)
    byRule.set(r.ruleId, list)
  }
  return rules.map((rule) => {
    const list = byRule.get(rule.id) ?? []
    const hasViolation = list.some((r) => r.status === "VIOLATED")
    const hasError = list.some((r) => r.status === "ERROR")
    const hasBlocking = list.some((r) => r.blocking)
    const allNA = list.length > 0 && list.every((r) => r.status === "NOT_APPLICABLE")
    const status: RuleStatus["status"] = !rule.checks || rule.checks.length === 0
      ? "ADVISORY"
      : hasViolation
        ? "VIOLATED"
        : hasError
          ? "ERROR"
          : allNA
            ? "NOT_APPLICABLE"
            : "PASS"
    return {
      ruleId: rule.id,
      title: rule.title,
      checkCount: rule.checks?.length ?? 0,
      status,
      blocking: hasBlocking,
    }
  })
}

export async function validateDeterministic(
  opts: DeterministicValidateOptions,
): Promise<DeterministicReport> {
  const rawResults: CheckResult[] = []
  const parseErrors: { ruleId: string; errors: readonly string[] }[] = []

  for (const rule of opts.rules) {
    if (rule.checkParseErrors && rule.checkParseErrors.length > 0) {
      parseErrors.push({ ruleId: rule.id, errors: rule.checkParseErrors })
    }
    if (!rule.checks || rule.checks.length === 0) continue
    for (const check of rule.checks) {
      const r = await runCheck(rule, check, opts)
      rawResults.push(...r)
    }
  }

  const { results, applied } = applyWaivers(rawResults, opts.waivers ?? [])
  const waivedCount = applied.filter((a) => !a.expired).length
  const summary = summarize(results, waivedCount)
  const ruleStatuses = aggregateRuleStatuses(opts.rules, results)

  let status: DeterministicReport["status"]
  if (summary.blocking > 0) status = "FAILED"
  else if (summary.violated > 0 || summary.error > 0) status = "PASSED_WITH_WARNINGS"
  else status = "PASSED"

  return { results, summary, status, ruleStatuses, parseErrors, waiversApplied: applied }
}
