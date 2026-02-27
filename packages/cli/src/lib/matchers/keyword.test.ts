import { describe, it, expect } from "vitest"
import { KeywordMatcher } from "./keyword.js"
import { makeRule } from "../../__tests__/setup.js"

const secretsRule = makeRule({
  id: "security.no-hardcoded-secrets",
  title: "No Hardcoded Secrets",
  content:
    "Never hardcode API keys, passwords, or tokens in source code.\n" +
    "- Use environment variables for all secrets\n" +
    "- Use a secrets manager for production",
  category: "security",
  severity: "error",
  modality: "must",
  tags: ["secrets", "api-keys"],
})

const authRule = makeRule({
  id: "security.authentication",
  title: "Authentication Standards",
  content:
    "All endpoints must require authentication.\n" +
    "- Use JWT or session-based authentication\n" +
    "- Always use httpOnly cookies for session tokens\n" +
    "- Never store tokens in localStorage",
  category: "security",
  severity: "error",
  modality: "must",
  tags: ["auth", "jwt", "session"],
})

describe("KeywordMatcher", () => {
  const matcher = new KeywordMatcher()

  it("should PASS when plan negates a prohibition (negation awareness)", async () => {
    const results = await matcher.match({
      plan: "We will ensure no hardcoded secrets exist and load all keys from env vars",
      rules: [secretsRule],
    })

    expect(results).toHaveLength(1)
    expect(results[0].ruleId).toBe("security.no-hardcoded-secrets")
    expect(results[0].status).toBe("PASS")
  })

  it("should VIOLATE when plan actually introduces a prohibited practice", async () => {
    const results = await matcher.match({
      plan: 'Set the API key to "sk_live_abc123" in the config file',
      rules: [secretsRule],
    })

    expect(results).toHaveLength(1)
    expect(results[0].ruleId).toBe("security.no-hardcoded-secrets")
    expect(results[0].status).toBe("VIOLATED")
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.5)
  })

  it("should PASS when plan addresses an auth rule with matching phrases", async () => {
    const results = await matcher.match({
      plan: "Implement JWT authentication with session management using httpOnly cookies",
      rules: [authRule],
    })

    expect(results).toHaveLength(1)
    expect(results[0].ruleId).toBe("security.authentication")
    expect(results[0].status).toBe("PASS")
  })

  it("should return NOT_COVERED for an unrelated plan", async () => {
    const results = await matcher.match({
      plan: "Add a CSS animation to the loading spinner",
      rules: [authRule],
    })

    expect(results).toHaveLength(1)
    expect(results[0].ruleId).toBe("security.authentication")
    expect(results[0].status).toBe("NOT_COVERED")
    expect(results[0].confidence).toBeLessThanOrEqual(0.5)
  })
})
