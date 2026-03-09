import { calculateScore, recordValidationEvent } from "@rulebound/engine"

interface ValidationTelemetryReport {
  readonly task?: string
  readonly results: readonly {
    readonly ruleId: string
    readonly status: string
  }[]
}

export function buildCliValidationEvent(report: ValidationTelemetryReport) {
  return {
    timestamp: new Date().toISOString(),
    rulesTotal: report.results.length,
    violated: report.results.filter((result) => result.status === "VIOLATED").map((result) => result.ruleId),
    passed: report.results.filter((result) => result.status === "PASS").map((result) => result.ruleId),
    notCovered: report.results
      .filter((result) => result.status === "NOT_COVERED")
      .map((result) => result.ruleId),
    score: calculateScore(report.results),
    task: report.task,
    source: "cli" as const,
  }
}

export function recordCliValidationEvent(
  report: ValidationTelemetryReport,
  cwd = process.cwd()
): void {
  try {
    recordValidationEvent(buildCliValidationEvent(report), cwd)
  } catch {
    // Telemetry must not block validation flows.
  }
}
