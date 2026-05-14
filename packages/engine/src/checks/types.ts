export type DeterministicSource =
  | "ast"
  | "regex"
  | "diff"
  | "file"
  | "import-boundary"
  | "command"
  | "analyzer"
  | "agent-process"
  | "keyword"
  | "semantic"
  | "llm"

export type ConfidenceLevel = "exact" | "high" | "medium" | "low" | "advisory"

export interface CheckEvidence {
  readonly filePath?: string
  readonly line?: number
  readonly column?: number
  readonly snippet?: string
  readonly diffPaths?: readonly string[]
  readonly command?: string
  readonly exitCode?: number
  readonly stdout?: string
  readonly stderr?: string
  readonly analyzerReport?: string
  readonly matches?: readonly string[]
}

export interface CheckResult {
  readonly ruleId: string
  readonly checkId: string
  readonly status: "PASS" | "VIOLATED" | "NOT_APPLICABLE" | "ERROR"
  readonly source: DeterministicSource
  readonly deterministic: boolean
  readonly confidence: ConfidenceLevel
  readonly blocking: boolean
  readonly reason: string
  readonly evidence?: CheckEvidence
  readonly suggestedFix?: string
  readonly waived?: {
    readonly reason: string
    readonly expires?: string
  }
}

interface BaseCheck {
  readonly id?: string
  readonly severity?: "error" | "warning" | "info"
  readonly message?: string
}

export interface AstCheck extends BaseCheck {
  readonly type: "ast"
  readonly language: string
  readonly builtin?: string
  readonly query?: string
}

export interface RegexCheck extends BaseCheck {
  readonly type: "regex"
  readonly pattern: string
  readonly flags?: string
  readonly files?: readonly string[]
  readonly forbidden?: boolean
  readonly require?: boolean
  readonly description?: string
}

export interface FileExistsCheck extends BaseCheck {
  readonly type: "file-exists"
  readonly path: string
  readonly description?: string
}

export interface FileNotExistsCheck extends BaseCheck {
  readonly type: "file-not-exists"
  readonly path: string
  readonly description?: string
}

export interface DiffEvidenceCheck extends BaseCheck {
  readonly type: "diff-evidence"
  readonly when_changed?: readonly string[]
  readonly require_changed?: readonly string[]
  readonly require_not_changed?: readonly string[]
  readonly branch_matches?: string
  readonly path_scope?: readonly string[]
}

export interface ForbiddenImportCheck extends BaseCheck {
  readonly type: "forbidden-import"
  readonly from: readonly string[]
  readonly importing: readonly string[]
  readonly description?: string
}

export interface CommandCheck extends BaseCheck {
  readonly type: "command"
  readonly run: string
  readonly pass_exit_codes?: readonly number[]
  readonly timeout_ms?: number
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string>>
  readonly env_allowlist?: readonly string[]
}

export interface AnalyzerCheck extends BaseCheck {
  readonly type: "analyzer"
  readonly analyzer:
    | "pmd"
    | "checkstyle"
    | "spotbugs"
    | "junit"
    | "eslint"
    | "tsc"
    | "semgrep"
    | "gitleaks"
    | "dependency-cruiser"
    | "sarif"
    | "generic"
  readonly run?: string
  readonly report: string
  readonly report_format?:
    | "pmd-xml"
    | "checkstyle-xml"
    | "spotbugs-xml"
    | "junit-xml"
    | "sarif"
    | "json"
    | "text"
  readonly fail_on_severity?: "error" | "warning" | "info"
  readonly pass_exit_codes?: readonly number[]
  readonly timeout_ms?: number
}

export interface AgentProcessCheck extends BaseCheck {
  readonly type: "agent-process"
  readonly require:
    | "find_rules_called"
    | "validate_plan_called"
    | "bugfix_spec_present"
    | "regression_test_added"
  readonly description?: string
}

export type RuleCheck =
  | AstCheck
  | RegexCheck
  | FileExistsCheck
  | FileNotExistsCheck
  | DiffEvidenceCheck
  | ForbiddenImportCheck
  | CommandCheck
  | AnalyzerCheck
  | AgentProcessCheck

export const ALL_CHECK_TYPES = [
  "ast",
  "regex",
  "file-exists",
  "file-not-exists",
  "diff-evidence",
  "forbidden-import",
  "command",
  "analyzer",
  "agent-process",
] as const

export type CheckType = (typeof ALL_CHECK_TYPES)[number]
