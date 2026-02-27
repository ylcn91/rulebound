import { describe, it, expect, vi } from "vitest"
import { LLMMatcher } from "./llm.js"
import { makeRule } from "../../__tests__/setup.js"

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      status: "PASS",
      confidence: 0.92,
      reason: "Plan explicitly addresses authentication with JWT and httpOnly cookies",
    },
  }),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue({ modelId: "claude-sonnet" }),
}))

describe("LLMMatcher", () => {
  it("returns structured result from LLM", async () => {
    const matcher = new LLMMatcher({ provider: "anthropic" })
    const rule = makeRule({
      id: "auth",
      title: "Authentication and Authorization",
      content: "All endpoints must check auth. Use httpOnly cookies.",
      tags: ["auth", "jwt"],
    })

    const results = await matcher.match({
      plan: "Implement JWT auth with httpOnly cookies",
      rules: [rule],
    })

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe("PASS")
    expect(results[0].confidence).toBeGreaterThan(0.8)
  })
})
