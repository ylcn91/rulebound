import { describe, it, expect } from "vitest"
import type { MatchResult, MatchStatus } from "./types.js"

describe("MatchResult type contract", () => {
  it("accepts valid match results", () => {
    const result: MatchResult = {
      ruleId: "test.rule",
      status: "PASS",
      confidence: 0.9,
      reason: "Plan addresses the rule",
    }
    expect(result.status).toBe("PASS")
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("accepts all valid statuses", () => {
    const statuses: MatchStatus[] = ["PASS", "VIOLATED", "NOT_COVERED"]
    for (const status of statuses) {
      const result: MatchResult = {
        ruleId: "test",
        status,
        confidence: 0.5,
        reason: "test",
      }
      expect(result.status).toBe(status)
    }
  })
})
