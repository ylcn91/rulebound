import {
  DEFAULT_ENFORCEMENT,
  calculateScore,
  recordValidationEvent,
  shouldBlock,
  type EnforcementMode,
  type ValidationReport,
} from "@rulebound/engine"
import type { ASTViolation } from "./ast-scanner.js"

export interface GatewayViolation {
  readonly ruleId: string
  readonly ruleTitle: string
  readonly severity: string
  readonly reason: string
  readonly suggestedFix?: string
  readonly codeSnippet: string
  readonly source: "semantic" | "ast"
  readonly modality: "must" | "should" | "may"
}

export interface EnforcementSummary {
  readonly hasMustViolation: boolean
  readonly hasShouldViolation: boolean
  readonly score: number
  readonly semanticScore: number
  readonly astErrorCount: number
  readonly astWarningCount: number
  readonly hasAdvisoryMustViolation: boolean
  readonly hasAdvisoryShouldViolation: boolean
}

/**
 * Build an enforcement summary for a gateway scan.
 *
 * Only deterministic findings (currently AST-based post-response scans) feed
 * into the blocking signals `hasMustViolation` / `hasShouldViolation`. Semantic
 * / LLM-assisted findings from `report` are advisory: they reduce the score
 * and surface as warnings but never trigger a block decision in the gateway.
 *
 * If a future deterministic post-response source is added (e.g. a regex or
 * file-evidence scan over the response payload), include it in the must/should
 * counts here.
 */
export function buildEnforcementSummary(
  report: ValidationReport | undefined,
  astViolations: readonly ASTViolation[],
): EnforcementSummary {
  const semanticViolations = report?.results.filter((result) => result.status === "VIOLATED") ?? []
  const hasAdvisoryMustViolation = semanticViolations.some((result) => result.modality === "must")
  const hasAdvisoryShouldViolation = semanticViolations.some((result) => result.modality === "should")

  const astErrorCount = astViolations.filter((violation) => violation.severity === "error").length
  const astWarningCount = astViolations.filter((violation) => violation.severity !== "error").length
  const semanticScore = calculateScore(report?.results ?? [])
  const score = clampScore(semanticScore - (astErrorCount * 20) - (astWarningCount * 10))

  return {
    hasMustViolation: astErrorCount > 0,
    hasShouldViolation: astWarningCount > 0,
    score,
    semanticScore,
    astErrorCount,
    astWarningCount,
    hasAdvisoryMustViolation,
    hasAdvisoryShouldViolation,
  }
}

/**
 * Decide whether the gateway should block a response.
 *
 * Only deterministic post-response findings can trigger a block. Semantic /
 * LLM-assisted findings are advisory and never affect this decision, even in
 * strict mode. The shared engine `shouldBlock` is used for behavior parity
 * but is fed a deterministic-only view of the summary (advisory findings
 * stripped, score derived from deterministic penalties only).
 */
export function shouldBlockForMode(
  mode: EnforcementMode,
  summary: EnforcementSummary,
): boolean {
  const deterministicScore = clampScore(
    100 - summary.astErrorCount * 20 - summary.astWarningCount * 10,
  )
  return shouldBlock(
    {
      ...DEFAULT_ENFORCEMENT,
      mode,
    },
    {
      hasMustViolation: summary.hasMustViolation,
      hasShouldViolation: summary.hasShouldViolation,
      score: deterministicScore,
    },
  )
}

export function recordGatewayValidationTelemetry(
  options: {
    report?: ValidationReport
    violations: readonly GatewayViolation[]
    enforcement: EnforcementSummary
    rulesTotal: number
    task?: string
    project?: string
  },
): void {
  const { report, violations, enforcement, rulesTotal, task, project } = options
  const semanticResults = report?.results ?? []
  const violated = [...new Set(violations.map((violation) => violation.ruleId))]
  const passed = semanticResults
    .filter((result) => result.status === "PASS")
    .map((result) => result.ruleId)
  const notCovered = semanticResults
    .filter((result) => result.status === "NOT_COVERED")
    .map((result) => result.ruleId)

  recordValidationEvent(
    {
      timestamp: new Date().toISOString(),
      rulesTotal,
      violated,
      passed,
      notCovered,
      score: enforcement.score,
      task,
      source: "gateway",
      project,
    },
    process.cwd(),
  )
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}
