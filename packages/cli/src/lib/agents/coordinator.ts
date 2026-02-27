import type { MatchResult, MatchStatus } from "../matchers/types.js"

export interface AgentReviewResult {
  readonly agentName: string
  readonly roles: readonly string[]
  readonly results: readonly MatchResult[]
}

export interface ConsensusResult {
  readonly status: "PASS" | "FAIL" | "WARN"
  readonly agentResults: readonly AgentReviewResult[]
  readonly summary: string
}

function collectStatuses(agentResults: readonly AgentReviewResult[]): readonly MatchStatus[] {
  return agentResults.flatMap((agent) =>
    agent.results.map((result) => result.status)
  )
}

function buildViolationSummary(agentResults: readonly AgentReviewResult[]): string {
  const violatingAgents = agentResults
    .filter((agent) =>
      agent.results.some((r) => r.status === "VIOLATED")
    )
    .map((agent) => agent.agentName)

  return `FAIL: Violations found by ${violatingAgents.join(", ")}`
}

function buildWarnSummary(agentResults: readonly AgentReviewResult[]): string {
  const uncoveredAgents = agentResults
    .filter((agent) =>
      agent.results.some((r) => r.status === "NOT_COVERED")
    )
    .map((agent) => agent.agentName)

  return `WARN: Uncovered rules reported by ${uncoveredAgents.join(", ")}`
}

export function buildConsensus(agentResults: readonly AgentReviewResult[]): ConsensusResult {
  const statuses = collectStatuses(agentResults)

  const hasViolation = statuses.includes("VIOLATED")
  const allPass = statuses.length > 0 && statuses.every((s) => s === "PASS")

  if (hasViolation) {
    return {
      status: "FAIL",
      agentResults,
      summary: buildViolationSummary(agentResults),
    }
  }

  if (allPass) {
    return {
      status: "PASS",
      agentResults,
      summary: "PASS: All agents agree — no violations found",
    }
  }

  return {
    status: "WARN",
    agentResults,
    summary: buildWarnSummary(agentResults),
  }
}
