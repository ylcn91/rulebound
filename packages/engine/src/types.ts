export type RuleSeverity = "error" | "warning" | "info"

export type RuleCategory =
  | "architecture"
  | "security"
  | "style"
  | "testing"
  | "performance"
  | "infra"
  | "workflow"
  | string

export type RuleModality = "must" | "should" | "may"

export interface Rule {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly category: string
  readonly severity: string
  readonly modality: string
  readonly tags: readonly string[]
  readonly stack: readonly string[]
  readonly scope: readonly string[]
  readonly changeTypes: readonly string[]
  readonly team: readonly string[]
  readonly filePath: string
}

export type MatchStatus = "PASS" | "VIOLATED" | "NOT_COVERED"

export interface MatchResult {
  readonly ruleId: string
  readonly status: MatchStatus
  readonly confidence: number
  readonly reason: string
  readonly suggestedFix?: string
}

export interface MatcherContext {
  readonly plan: string
  readonly rules: readonly Rule[]
  readonly task?: string
}

export interface Matcher {
  readonly name: string
  match(context: MatcherContext): Promise<readonly MatchResult[]>
}

export interface PipelineResult {
  readonly results: readonly MatchResult[]
  readonly layers: readonly string[]
}

export type EnforcementMode = "advisory" | "moderate" | "strict"

export interface EnforcementConfig {
  readonly mode: EnforcementMode
  readonly scoreThreshold: number
  readonly autoPromote: boolean
}

export interface ValidationResult {
  readonly ruleId: string
  readonly ruleTitle: string
  readonly severity: string
  readonly modality: string
  readonly status: MatchStatus
  readonly reason: string
  readonly suggestedFix?: string
}

export interface ValidationReport {
  readonly task: string
  readonly rulesMatched: number
  readonly rulesTotal: number
  readonly results: readonly ValidationResult[]
  readonly summary: {
    readonly pass: number
    readonly violated: number
    readonly notCovered: number
  }
  readonly status: "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED"
}

export interface ProjectConfig {
  readonly name?: string
  readonly stack?: string[]
  readonly scope?: string[]
  readonly team?: string
}

export interface ValidateOptions {
  readonly plan: string
  readonly rules: readonly Rule[]
  readonly task?: string
  readonly useLlm?: boolean
  readonly llmProvider?: "anthropic" | "openai"
  readonly llmModel?: string
}

export interface BlockCheckInput {
  readonly hasMustViolation: boolean
  readonly hasShouldViolation?: boolean
  readonly score: number
}

export interface LLMConfig {
  readonly provider: "anthropic" | "openai"
  readonly model?: string
}

export interface RuleboundConfig {
  readonly project?: ProjectConfig & { name?: string }
  readonly agents?: string[]
  readonly rulesDir?: string
  readonly extends?: string[]
  readonly enforcement?: Partial<EnforcementConfig>
  readonly projectName?: string
}
