export interface LocalRule {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly category: string
  readonly severity: string
  readonly modality: string
  readonly tags: readonly string[]
  readonly stack: readonly string[]
  readonly filePath: string
}

export interface ValidationResult {
  ruleId: string
  ruleTitle: string
  severity: string
  modality: string
  status: "PASS" | "VIOLATED" | "NOT_COVERED"
  reason: string
  suggestedFix?: string
}

export interface ValidationReport {
  task: string
  rulesTotal: number
  results: ValidationResult[]
  summary: { pass: number; violated: number; notCovered: number }
  status: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED"
}
