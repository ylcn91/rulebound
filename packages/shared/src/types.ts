// ── Rule Types ────────────────────────────────────────

export type RuleSeverity = "error" | "warning" | "info"

export type RuleCategory =
  | "architecture"
  | "security"
  | "style"
  | "testing"
  | "performance"

export interface Rule {
  id: string
  title: string
  content: string
  category: RuleCategory
  tags: string[]
  severity: RuleSeverity
  isActive: boolean
  version: number
  ruleSetId: string
  createdAt: string
  updatedAt: string
}

// ── RuleSet Types ─────────────────────────────────────

export interface RuleSet {
  id: string
  orgId: string
  name: string
  description: string | null
  isGlobal: boolean
  createdAt: string
  updatedAt: string
}

// ── Project Types ─────────────────────────────────────

export interface Project {
  id: string
  orgId: string
  name: string
  slug: string
  repoUrl: string | null
  createdAt: string
  updatedAt: string
}

// ── API Token Types ───────────────────────────────────

export interface ApiToken {
  id: string
  userId: string
  name: string
  scopes: string[]
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

// ── CLI Config Types ──────────────────────────────────

export interface CliConfig {
  serverUrl: string
  token: string | null
  currentProject: string | null
}

export interface ProjectConfig {
  projectName: string
  agents: AgentType[]
  serverUrl: string
}

export type AgentType = "claude-code" | "cursor" | "copilot"

// ── API Response Types ────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export type ValidationStatus = "PASS" | "WARN" | "FAIL"

export interface ValidationResult {
  ruleId: string
  ruleTitle: string
  severity: RuleSeverity
  status: ValidationStatus
  message: string
}

export interface ValidateResponse {
  results: ValidationResult[]
  summary: {
    total: number
    pass: number
    warn: number
    fail: number
  }
}

export interface FindRulesParams {
  title?: string
  category?: RuleCategory
  tags?: string
}
