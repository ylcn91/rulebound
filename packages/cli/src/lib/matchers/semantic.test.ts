import { describe, it, expect } from "vitest"
import { SemanticMatcher } from "./semantic.js"
import { makeRule } from "../../__tests__/setup.js"

const authRule = makeRule({
  id: "auth.rule",
  title: "Authentication and Authorization",
  content:
    "All endpoints must use httpOnly cookies for session tokens. " +
    "Implement role-based access control for protected resources. " +
    "Use secure JWT tokens with proper expiration and refresh flows.",
  category: "security",
  tags: ["auth", "jwt", "session", "rbac"],
})

describe("SemanticMatcher", () => {
  const matcher = new SemanticMatcher()

  it("returns PASS when plan is semantically related to a rule", async () => {
    const results = await matcher.match({
      plan: "JWT tokens stored in httpOnly cookies with session refresh",
      rules: [authRule],
    })

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe("PASS")
    expect(results[0].confidence).toBeGreaterThan(0.4)
    expect(results[0].ruleId).toBe("auth.rule")
  })

  it("returns NOT_COVERED when plan is completely unrelated", async () => {
    const results = await matcher.match({
      plan: "Add CSS grid layout to the dashboard page with responsive breakpoints",
      rules: [authRule],
    })

    expect(results).toHaveLength(1)
    expect(results[0].status).toBe("NOT_COVERED")
    expect(results[0].ruleId).toBe("auth.rule")
  })

  it("returns results for each rule when given multiple rules", async () => {
    const cssRule = makeRule({
      id: "css.rule",
      title: "CSS Standards",
      content: "Use Tailwind CSS utility classes for all styling.",
      category: "frontend",
      tags: ["css", "tailwind"],
    })

    const results = await matcher.match({
      plan: "JWT tokens stored in httpOnly cookies with session refresh",
      rules: [authRule, cssRule],
    })

    expect(results).toHaveLength(2)
    expect(results.map((r) => r.ruleId)).toContain("auth.rule")
    expect(results.map((r) => r.ruleId)).toContain("css.rule")
  })
})
