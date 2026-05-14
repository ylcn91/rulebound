import type { CheckResult, DiffEvidenceCheck } from "../types.js"
import { globToRegex } from "./regex.js"

export interface DiffRunOptions {
  readonly ruleId: string
  readonly check: DiffEvidenceCheck
  readonly changedFiles: readonly string[]
  readonly branch?: string
}

function anyMatch(files: readonly string[], patterns: readonly string[]): string[] {
  const regs = patterns.map((p) => globToRegex(p))
  return files.filter((f) => regs.some((r) => r.test(f)))
}

export function runDiffCheck(opts: DiffRunOptions): CheckResult {
  const { ruleId, check, changedFiles, branch } = opts
  const checkId = check.id ?? "diff-evidence"
  const severity = check.severity ?? "error"

  if (check.branch_matches) {
    const re = new RegExp(check.branch_matches)
    if (!branch || !re.test(branch)) {
      return {
        ruleId,
        checkId,
        status: "NOT_APPLICABLE",
        source: "diff",
        deterministic: true,
        confidence: "exact",
        blocking: false,
        reason: `Branch '${branch ?? "(unknown)"}' does not match ${check.branch_matches}`,
      }
    }
  }

  if (check.path_scope && check.path_scope.length > 0) {
    const scopedChanges = anyMatch(changedFiles, check.path_scope)
    if (scopedChanges.length === 0) {
      return {
        ruleId,
        checkId,
        status: "NOT_APPLICABLE",
        source: "diff",
        deterministic: true,
        confidence: "exact",
        blocking: false,
        reason: `No changed files within path_scope`,
      }
    }
  }

  if (check.when_changed && check.when_changed.length > 0) {
    const trigger = anyMatch(changedFiles, check.when_changed)
    if (trigger.length === 0) {
      return {
        ruleId,
        checkId,
        status: "NOT_APPLICABLE",
        source: "diff",
        deterministic: true,
        confidence: "exact",
        blocking: false,
        reason: `Trigger (when_changed) not matched in this diff`,
      }
    }
  }

  if (check.require_changed && check.require_changed.length > 0) {
    const required = anyMatch(changedFiles, check.require_changed)
    if (required.length === 0) {
      return {
        ruleId,
        checkId,
        status: "VIOLATED",
        source: "diff",
        deterministic: true,
        confidence: "exact",
        blocking: severity === "error",
        reason:
          check.message ??
          `Diff missing required evidence files. Expected at least one of: ${check.require_changed.join(", ")}`,
        evidence: { diffPaths: changedFiles.slice(0, 50) },
      }
    }
  }

  if (check.require_not_changed && check.require_not_changed.length > 0) {
    const forbidden = anyMatch(changedFiles, check.require_not_changed)
    if (forbidden.length > 0) {
      return {
        ruleId,
        checkId,
        status: "VIOLATED",
        source: "diff",
        deterministic: true,
        confidence: "exact",
        blocking: severity === "error",
        reason:
          check.message ??
          `Diff touches forbidden paths: ${forbidden.join(", ")}`,
        evidence: { diffPaths: forbidden.slice(0, 50) },
      }
    }
  }

  return {
    ruleId,
    checkId,
    status: "PASS",
    source: "diff",
    deterministic: true,
    confidence: "exact",
    blocking: false,
    reason: "Diff evidence satisfied",
  }
}
