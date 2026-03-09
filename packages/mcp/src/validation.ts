import {
  DEFAULT_ENFORCEMENT,
  calculateScore,
  recordValidationEvent,
  shouldBlock,
  type EnforcementMode,
} from "@rulebound/engine"
import type { ValidationReport } from "./types.js"

export interface AstValidationViolation {
  readonly rule: string
  readonly line?: number
  readonly message: string
  readonly severity: string
}

export interface ValidationViolation {
  readonly rule: string
  readonly line?: number
  readonly message: string
  readonly severity: string
  readonly fix?: string
  readonly source: "ast" | "semantic"
  readonly modality: "must" | "should" | "may"
}

export interface ValidationEnforcementSummary {
  readonly hasMustViolation: boolean
  readonly hasShouldViolation: boolean
  readonly score: number
  readonly semanticScore: number
  readonly astErrorCount: number
  readonly astWarningCount: number
}

export function buildValidationViolations(
  report: ValidationReport | null,
  astViolations: readonly AstValidationViolation[],
): ValidationViolation[] {
  const semanticViolations = report?.results
    .filter((result) => result.status === "VIOLATED")
    .map((result) => ({
      rule: result.ruleId,
      message: result.reason,
      severity: result.severity,
      fix: result.suggestedFix,
      source: "semantic" as const,
      modality: normalizeModality(result.modality),
    }))
    ?? []

  return [
    ...astViolations.map((violation) => ({
      ...violation,
      source: "ast" as const,
      modality: violation.severity === "error" ? "must" as const : "should" as const,
    })),
    ...semanticViolations,
  ]
}

export function buildValidationEnforcementSummary(
  report: ValidationReport | null,
  astViolations: readonly AstValidationViolation[],
): ValidationEnforcementSummary {
  const semanticViolations = report?.results.filter((result) => result.status === "VIOLATED") ?? []
  const astErrorCount = astViolations.filter((violation) => violation.severity === "error").length
  const astWarningCount = astViolations.filter((violation) => violation.severity !== "error").length
  const semanticScore = calculateScore(report?.results ?? [])
  const score = clampScore(semanticScore - (astErrorCount * 20) - (astWarningCount * 10))

  return {
    hasMustViolation: semanticViolations.some((result) => result.modality === "must") || astErrorCount > 0,
    hasShouldViolation: semanticViolations.some((result) => result.modality === "should") || astWarningCount > 0,
    score,
    semanticScore,
    astErrorCount,
    astWarningCount,
  }
}

export function shouldBlockValidation(
  mode: EnforcementMode,
  summary: ValidationEnforcementSummary,
): boolean {
  return shouldBlock(
    {
      ...DEFAULT_ENFORCEMENT,
      mode,
    },
    summary,
  )
}

export function recordMcpValidationTelemetry(options: {
  report: ValidationReport | null
  violations: readonly ValidationViolation[]
  enforcement: ValidationEnforcementSummary
  rulesTotal: number
  task?: string
}): void {
  const { report, violations, enforcement, rulesTotal, task } = options

  recordValidationEvent(
    {
      timestamp: new Date().toISOString(),
      rulesTotal,
      violated: [...new Set(violations.map((violation) => violation.rule))],
      passed: report?.results.filter((result) => result.status === "PASS").map((result) => result.ruleId) ?? [],
      notCovered: report?.results.filter((result) => result.status === "NOT_COVERED").map((result) => result.ruleId) ?? [],
      score: enforcement.score,
      task,
      source: "mcp",
    },
    process.cwd(),
  )
}

function normalizeModality(modality: string): "must" | "should" | "may" {
  if (modality === "must" || modality === "should" || modality === "may") {
    return modality
  }
  return "may"
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}
