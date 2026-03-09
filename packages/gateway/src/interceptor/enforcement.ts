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
}

export function buildEnforcementSummary(
  report: ValidationReport | undefined,
  astViolations: readonly ASTViolation[],
): EnforcementSummary {
  const semanticViolations = report?.results.filter((result) => result.status === "VIOLATED") ?? []
  const hasSemanticMustViolation = semanticViolations.some((result) => result.modality === "must")
  const hasSemanticShouldViolation = semanticViolations.some((result) => result.modality === "should")

  const astErrorCount = astViolations.filter((violation) => violation.severity === "error").length
  const astWarningCount = astViolations.filter((violation) => violation.severity !== "error").length
  const semanticScore = calculateScore(report?.results ?? [])
  const score = clampScore(semanticScore - (astErrorCount * 20) - (astWarningCount * 10))

  return {
    hasMustViolation: hasSemanticMustViolation || astErrorCount > 0,
    hasShouldViolation: hasSemanticShouldViolation || astWarningCount > 0,
    score,
    semanticScore,
    astErrorCount,
    astWarningCount,
  }
}

export function shouldBlockForMode(
  mode: EnforcementMode,
  summary: EnforcementSummary,
): boolean {
  return shouldBlock(
    {
      ...DEFAULT_ENFORCEMENT,
      mode,
    },
    summary,
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
