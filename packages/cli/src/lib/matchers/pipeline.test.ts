import { describe, it, expect } from "vitest"
import { ValidationPipeline } from "./pipeline.js"
import { KeywordMatcher } from "./keyword.js"
import { SemanticMatcher } from "./semantic.js"
import { makeRule } from "../../__tests__/setup.js"

describe("ValidationPipeline", () => {
  it("runs multiple matchers and merges by highest confidence", async () => {
    const pipeline = new ValidationPipeline([new KeywordMatcher(), new SemanticMatcher()])
    const rule = makeRule({
      id: "auth",
      title: "Authentication and Authorization",
      content: "Use httpOnly cookies.\n- All endpoints must check authentication",
      tags: ["auth", "jwt"],
    })

    const result = await pipeline.run({
      plan: "Implement JWT authentication with httpOnly cookie storage",
      rules: [rule],
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].status).toBe("PASS")
    expect(result.layers).toContain("keyword")
    expect(result.layers).toContain("semantic")
  })

  it("upper layer wins on conflict with same confidence", async () => {
    const pipeline = new ValidationPipeline([new KeywordMatcher(), new SemanticMatcher()])
    const rule = makeRule({
      id: "secrets",
      title: "No Hardcoded Secrets",
      content: "Never hardcode API keys.\n- Never hardcode API keys in source files",
      tags: ["secrets", "env"],
      modality: "must",
    })

    const result = await pipeline.run({
      plan: "We will ensure no hardcoded secrets and use env vars for all credentials",
      rules: [rule],
    })

    expect(result.results[0].status).toBe("PASS")
  })

  it("returns NOT_COVERED when no matcher finds relevance", async () => {
    const pipeline = new ValidationPipeline([new KeywordMatcher(), new SemanticMatcher()])
    const rule = makeRule({
      id: "auth",
      title: "Authentication",
      content: "All endpoints must check auth",
      tags: ["auth"],
    })

    const result = await pipeline.run({
      plan: "Add CSS animation to loading spinner",
      rules: [rule],
    })

    expect(result.results[0].status).toBe("NOT_COVERED")
  })
})
