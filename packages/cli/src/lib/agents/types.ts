export type EnforcementMode = "advisory" | "moderate" | "strict"

export interface AgentProfile {
  readonly name: string
  readonly roles: readonly string[]
  readonly rules: readonly string[]
  readonly enforcement: EnforcementMode
}

export interface AgentReviewResult {
  readonly agentName: string
  readonly roles: readonly string[]
  readonly results: readonly import("../matchers/types.js").MatchResult[]
}

export interface ConsensusResult {
  readonly status: "PASS" | "FAIL" | "WARN"
  readonly agentResults: readonly AgentReviewResult[]
  readonly summary: string
}
