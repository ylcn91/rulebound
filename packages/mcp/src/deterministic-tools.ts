import { execFileSync } from "node:child_process"
import {
  findRulesDir as engineFindRulesDir,
  loadLocalRules as engineLoadLocalRules,
  validateDeterministic,
  type DeterministicReport,
  type Rule,
  type RuleStatus,
  type CheckResult,
} from "@rulebound/engine"
import { logger } from "@rulebound/shared/logger"

const SAFE_REF_PATTERN = /^[a-zA-Z0-9._\-/~^]+$/

export interface DeterministicRunInput {
  readonly cwd: string
  readonly changedFiles?: readonly string[]
  readonly branch?: string
  readonly allowCommands?: boolean
}

export interface DeterministicSummary {
  readonly status: DeterministicReport["status"]
  readonly summary: DeterministicReport["summary"]
  readonly ruleStatuses: readonly RuleStatus[]
  readonly topViolations: readonly TopViolation[]
  readonly parseErrors: DeterministicReport["parseErrors"]
  readonly rulesEvaluated: number
  readonly note?: string
}

export interface TopViolation {
  readonly ruleId: string
  readonly checkId: string
  readonly source: CheckResult["source"]
  readonly file?: string
  readonly line?: number
  readonly reason: string
  readonly suggestedFix?: string
  readonly blocking: boolean
}

export interface RepairInstruction {
  readonly ruleId: string
  readonly checkId: string
  readonly file?: string
  readonly line?: number
  readonly reason: string
  readonly suggestedFix?: string
  readonly source: CheckResult["source"]
  readonly rerunCommand: string
  readonly blocking: boolean
}

const MAX_VIOLATIONS = 5
const NO_RULES_NOTE = "No rules directory found. Run 'rulebound init' first."
const NO_CHECKS_NOTE = "No deterministic checks defined in any rule."

function loadRulesWithChecks(cwd: string): readonly Rule[] {
  const dir = engineFindRulesDir(cwd)
  if (!dir) return []
  return engineLoadLocalRules(dir)
}

function topViolations(results: readonly CheckResult[]): readonly TopViolation[] {
  return results
    .filter((r) => r.status === "VIOLATED" || r.status === "ERROR")
    .slice(0, MAX_VIOLATIONS)
    .map((r) => ({
      ruleId: r.ruleId,
      checkId: r.checkId,
      source: r.source,
      ...(r.evidence?.filePath !== undefined ? { file: r.evidence.filePath } : {}),
      ...(r.evidence?.line !== undefined ? { line: r.evidence.line } : {}),
      reason: r.reason,
      ...(r.suggestedFix !== undefined ? { suggestedFix: r.suggestedFix } : {}),
      blocking: r.blocking,
    }))
}

function buildRerunCommand(changedFiles: readonly string[], branch?: string): string {
  if (changedFiles.length > 0) {
    return `rulebound run-checks --files "${changedFiles.slice(0, 10).join(",")}"`
  }
  if (branch) return `rulebound run-checks --branch ${branch}`
  return "rulebound run-checks"
}

export async function runDeterministicChecks(
  input: DeterministicRunInput,
): Promise<DeterministicSummary> {
  const rules = loadRulesWithChecks(input.cwd)
  if (rules.length === 0) {
    return {
      status: "PASSED",
      summary: { total: 0, pass: 0, violated: 0, notApplicable: 0, error: 0, blocking: 0, waived: 0 },
      ruleStatuses: [],
      topViolations: [],
      parseErrors: [],
      rulesEvaluated: 0,
      note: NO_RULES_NOTE,
    }
  }

  const rulesWithChecks = rules.filter((r) => r.checks && r.checks.length > 0)
  if (rulesWithChecks.length === 0) {
    return {
      status: "PASSED",
      summary: { total: 0, pass: 0, violated: 0, notApplicable: 0, error: 0, blocking: 0, waived: 0 },
      ruleStatuses: [],
      topViolations: [],
      parseErrors: [],
      rulesEvaluated: 0,
      note: NO_CHECKS_NOTE,
    }
  }

  const report = await validateDeterministic({
    cwd: input.cwd,
    rules: rulesWithChecks,
    ...(input.changedFiles !== undefined ? { changedFiles: input.changedFiles } : {}),
    ...(input.branch !== undefined ? { branch: input.branch } : {}),
    allowCommandExecution: input.allowCommands ?? false,
  })

  return {
    status: report.status,
    summary: report.summary,
    ruleStatuses: report.ruleStatuses,
    topViolations: topViolations(report.results),
    parseErrors: report.parseErrors,
    rulesEvaluated: rulesWithChecks.length,
  }
}

export interface CheckDiffInput {
  readonly cwd: string
  readonly base?: string
  readonly branch?: string
  readonly allowCommands?: boolean
  readonly staged?: boolean
}

export function getChangedFilesFromGit(input: {
  readonly cwd: string
  readonly base?: string
  readonly staged?: boolean
}): readonly string[] {
  const { cwd, base, staged } = input
  try {
    if (staged) {
      const out = execFileSync("git", ["diff", "--name-only", "--cached"], {
        cwd,
        encoding: "utf-8",
      })
      return parseFiles(out)
    }
    if (base) {
      if (!SAFE_REF_PATTERN.test(base)) {
        throw new Error(`Invalid base ref: "${base}".`)
      }
      const out = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], {
        cwd,
        encoding: "utf-8",
      })
      return parseFiles(out)
    }
    const out = execFileSync("git", ["diff", "--name-only", "HEAD"], {
      cwd,
      encoding: "utf-8",
    })
    return parseFiles(out)
  } catch (error) {
    logger.debug("git diff failed", {
      cwd,
      base,
      staged,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

function parseFiles(stdout: string): readonly string[] {
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export async function checkDiff(input: CheckDiffInput): Promise<DeterministicSummary> {
  const changedFiles = getChangedFilesFromGit({
    cwd: input.cwd,
    ...(input.base !== undefined ? { base: input.base } : {}),
    ...(input.staged !== undefined ? { staged: input.staged } : {}),
  })

  if (changedFiles.length === 0) {
    return {
      status: "PASSED",
      summary: { total: 0, pass: 0, violated: 0, notApplicable: 0, error: 0, blocking: 0, waived: 0 },
      ruleStatuses: [],
      topViolations: [],
      parseErrors: [],
      rulesEvaluated: 0,
      note: "No changed files detected — nothing to check.",
    }
  }

  return runDeterministicChecks({
    cwd: input.cwd,
    changedFiles,
    ...(input.branch !== undefined ? { branch: input.branch } : {}),
    ...(input.allowCommands !== undefined ? { allowCommands: input.allowCommands } : {}),
  })
}

export interface RepairInstructionsInput {
  readonly cwd: string
  readonly changedFiles?: readonly string[]
  readonly branch?: string
  readonly allowCommands?: boolean
  readonly limit?: number
}

export interface RepairInstructionsResult {
  readonly status: DeterministicReport["status"]
  readonly instructions: readonly RepairInstruction[]
  readonly totalViolations: number
  readonly note?: string
}

export async function getRepairInstructions(
  input: RepairInstructionsInput,
): Promise<RepairInstructionsResult> {
  const rules = loadRulesWithChecks(input.cwd)
  if (rules.length === 0) {
    return {
      status: "PASSED",
      instructions: [],
      totalViolations: 0,
      note: NO_RULES_NOTE,
    }
  }

  const rulesWithChecks = rules.filter((r) => r.checks && r.checks.length > 0)
  if (rulesWithChecks.length === 0) {
    return {
      status: "PASSED",
      instructions: [],
      totalViolations: 0,
      note: NO_CHECKS_NOTE,
    }
  }

  const report = await validateDeterministic({
    cwd: input.cwd,
    rules: rulesWithChecks,
    ...(input.changedFiles !== undefined ? { changedFiles: input.changedFiles } : {}),
    ...(input.branch !== undefined ? { branch: input.branch } : {}),
    allowCommandExecution: input.allowCommands ?? false,
  })

  const limit = input.limit ?? 20
  const offenders = report.results.filter(
    (r) => r.status === "VIOLATED" || r.status === "ERROR",
  )

  const rerunCommand = buildRerunCommand(
    input.changedFiles ?? [],
    input.branch,
  )

  const instructions: RepairInstruction[] = offenders.slice(0, limit).map((r) => ({
    ruleId: r.ruleId,
    checkId: r.checkId,
    ...(r.evidence?.filePath !== undefined ? { file: r.evidence.filePath } : {}),
    ...(r.evidence?.line !== undefined ? { line: r.evidence.line } : {}),
    reason: r.reason,
    ...(r.suggestedFix !== undefined ? { suggestedFix: r.suggestedFix } : {}),
    source: r.source,
    rerunCommand,
    blocking: r.blocking,
  }))

  return {
    status: report.status,
    instructions,
    totalViolations: offenders.length,
  }
}
