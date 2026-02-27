import { describe, it, expect } from "vitest"
import { buildConsensus, type AgentReviewResult } from "./coordinator.js"

describe("buildConsensus", () => {
  it("PASS when all agents pass", () => {
    const results: AgentReviewResult[] = [
      {
        agentName: "claude",
        roles: ["architect"],
        results: [{ ruleId: "auth", status: "PASS", confidence: 0.9, reason: "OK" }],
      },
      {
        agentName: "codex",
        roles: ["implementer"],
        results: [{ ruleId: "auth", status: "PASS", confidence: 0.8, reason: "OK" }],
      },
    ]
    const consensus = buildConsensus(results)
    expect(consensus.status).toBe("PASS")
  })

  it("FAIL when any agent finds VIOLATED", () => {
    const results: AgentReviewResult[] = [
      {
        agentName: "claude",
        roles: ["architect"],
        results: [{ ruleId: "secrets", status: "PASS", confidence: 0.9, reason: "OK" }],
      },
      {
        agentName: "claude-admin",
        roles: ["security"],
        results: [{ ruleId: "secrets", status: "VIOLATED", confidence: 0.95, reason: "Hardcoded key found" }],
      },
    ]
    const consensus = buildConsensus(results)
    expect(consensus.status).toBe("FAIL")
  })

  it("WARN when agents have mixed non-violation results", () => {
    const results: AgentReviewResult[] = [
      {
        agentName: "claude",
        roles: ["architect"],
        results: [{ ruleId: "testing", status: "PASS", confidence: 0.8, reason: "OK" }],
      },
      {
        agentName: "codex",
        roles: ["qa"],
        results: [{ ruleId: "testing", status: "NOT_COVERED", confidence: 0.5, reason: "Not addressed" }],
      },
    ]
    const consensus = buildConsensus(results)
    expect(consensus.status).toBe("WARN")
  })
})
