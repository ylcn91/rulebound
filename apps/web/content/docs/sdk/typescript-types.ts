import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "sdk/typescript-types",
  title: "TypeScript Types",
  description: "Complete TypeScript type reference for the Rulebound engine, gateway, and server packages.",
  content: `## TypeScript Types

All Rulebound packages are written in TypeScript with strict mode. This reference covers the key types exported from each package.

### Engine Types

#### Rule

\`\`\`typescript
interface Rule {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly category: string       // "architecture" | "security" | "style" | ...
  readonly severity: string       // "error" | "warning" | "info"
  readonly modality: string       // "must" | "should" | "may"
  readonly tags: readonly string[]
  readonly stack: readonly string[]
  readonly scope: readonly string[]
  readonly changeTypes: readonly string[]
  readonly team: readonly string[]
  readonly filePath: string
}

type RuleSeverity = "error" | "warning" | "info"
type RuleCategory = "architecture" | "security" | "style" | "testing" | "performance" | "infra" | "workflow" | string
type RuleModality = "must" | "should" | "may"
\`\`\`

#### Validation

\`\`\`typescript
interface ValidationResult {
  readonly ruleId: string
  readonly ruleTitle: string
  readonly severity: string
  readonly modality: string
  readonly status: "PASS" | "VIOLATED" | "NOT_COVERED"
  readonly reason: string
  readonly suggestedFix?: string
}

interface ValidationReport {
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

interface ValidateOptions {
  readonly plan: string
  readonly rules: readonly Rule[]
  readonly task?: string
  readonly useLlm?: boolean
  readonly llmProvider?: "anthropic" | "openai"
  readonly llmModel?: string
}
\`\`\`

#### Matching

\`\`\`typescript
type MatchStatus = "PASS" | "VIOLATED" | "NOT_COVERED"

interface MatchResult {
  readonly ruleId: string
  readonly status: MatchStatus
  readonly confidence: number
  readonly reason: string
  readonly suggestedFix?: string
}

interface MatcherContext {
  readonly plan: string
  readonly rules: readonly Rule[]
  readonly task?: string
}

interface Matcher {
  readonly name: string
  match(context: MatcherContext): Promise<readonly MatchResult[]>
}
\`\`\`

#### Enforcement

\`\`\`typescript
type EnforcementMode = "advisory" | "moderate" | "strict"

interface EnforcementConfig {
  readonly mode: EnforcementMode
  readonly scoreThreshold: number
  readonly autoPromote: boolean
}

interface BlockCheckInput {
  readonly hasMustViolation: boolean
  readonly hasShouldViolation?: boolean
  readonly score: number
}
\`\`\`

#### AST Types

\`\`\`typescript
type SupportedLanguage =
  | "typescript" | "javascript" | "python"
  | "java" | "go" | "rust"
  | "c_sharp" | "cpp" | "ruby" | "bash"

interface ASTQueryDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly language: SupportedLanguage | "*"
  readonly severity: "error" | "warning" | "info"
  readonly category: string
  readonly query: string
  readonly message: string
  readonly suggestedFix?: string
  readonly captureFilters?: Record<string, string | readonly string[]>
}

interface ASTMatch {
  readonly queryId: string
  readonly queryName: string
  readonly message: string
  readonly severity: "error" | "warning" | "info"
  readonly suggestedFix?: string
  readonly location: {
    readonly startRow: number
    readonly startColumn: number
    readonly endRow: number
    readonly endColumn: number
  }
  readonly matchedText: string
  readonly capturedNodes: readonly ASTCapturedNode[]
}

interface ASTAnalysisResult {
  readonly language: SupportedLanguage
  readonly matches: readonly ASTMatch[]
  readonly parseErrors: number
  readonly nodeCount: number
  readonly parseTimeMs: number
  readonly queryTimeMs: number
}
\`\`\`

#### Configuration

\`\`\`typescript
interface ProjectConfig {
  readonly name?: string
  readonly stack?: string[]
  readonly scope?: string[]
  readonly team?: string
}

interface RuleboundConfig {
  readonly project?: ProjectConfig & { name?: string }
  readonly agents?: string[]
  readonly rulesDir?: string
  readonly extends?: string[]
  readonly enforcement?: Partial<EnforcementConfig>
  readonly projectName?: string
}
\`\`\`

### Gateway Types

\`\`\`typescript
interface GatewayConfig {
  readonly port: number
  readonly ruleboundServerUrl?: string
  readonly ruleboundApiKey?: string
  readonly targets: {
    readonly openai?: string
    readonly anthropic?: string
    readonly google?: string
  }
  readonly enforcement: "advisory" | "moderate" | "strict"
  readonly injectRules: boolean
  readonly scanResponses: boolean
  readonly auditLog: boolean
  readonly project?: string
  readonly stack?: string[]
}

interface ScanResult {
  hasViolations: boolean
  violations: Array<{
    ruleTitle: string
    severity: string
    reason: string
    suggestedFix?: string
    codeSnippet: string
  }>
  report?: ValidationReport
}

interface CodeBlock {
  readonly code: string
  readonly language: string | null
}

interface StreamScannerConfig {
  rules: Rule[]
  enforcement: "advisory" | "moderate" | "strict"
  onViolation?: (warning: string) => void
}

interface ASTViolation {
  readonly ruleTitle: string
  readonly severity: string
  readonly reason: string
  readonly line: number
  readonly codeSnippet: string
}
\`\`\`

### Server Types

\`\`\`typescript
type WebhookEvent =
  | "violation.detected"
  | "compliance.score_changed"
  | "rule.created"
  | "rule.updated"
  | "rule.deleted"
  | "sync.completed"

interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
}

interface DeliveryResult {
  success: boolean
  statusCode?: number
  error?: string
}

interface NotificationPayload {
  event: string
  title: string
  message: string
  severity?: "error" | "warning" | "info"
  project?: string
  rule?: string
  score?: number
  url?: string
}

interface NotificationResult {
  success: boolean
  provider: string
  error?: string
}
\`\`\`
`,
}

export default doc
