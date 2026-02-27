import { describe, it, expect } from "vitest"
import { ValidationPipeline } from "../lib/matchers/pipeline.js"
import { KeywordMatcher } from "../lib/matchers/keyword.js"
import { SemanticMatcher } from "../lib/matchers/semantic.js"
import { loadLocalRules } from "../lib/local-rules.js"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const FIXTURES_DIR = join(__dirname, "fixtures", "rules")

describe("Integration: full pipeline with real rules", () => {
  const pipeline = new ValidationPipeline([new KeywordMatcher(), new SemanticMatcher()])

  it("PASS: plan about env vars passes no-secrets rule", async () => {
    const rules = loadLocalRules(FIXTURES_DIR)
    const secretsRule = rules.find((r) => r.title.includes("Hardcoded"))!

    const result = await pipeline.run({
      plan: "We will ensure no hardcoded secrets and load all API keys from environment variables using dotenv",
      rules: [secretsRule],
    })

    expect(result.results[0].status).toBe("PASS")
  })

  it("PASS: JWT plan matches auth rule via semantic similarity", async () => {
    const rules = loadLocalRules(FIXTURES_DIR)
    const authRule = rules.find((r) => r.title.includes("Authentication"))!

    const result = await pipeline.run({
      plan: "Implement JWT tokens stored in httpOnly cookies with session refresh rotation and RBAC",
      rules: [authRule],
    })

    expect(result.results[0].status).toBe("PASS")
  })

  it("NOT_COVERED: CSS plan does not match auth rule", async () => {
    const rules = loadLocalRules(FIXTURES_DIR)
    const authRule = rules.find((r) => r.title.includes("Authentication"))!

    const result = await pipeline.run({
      plan: "Add CSS grid layout to the dashboard page with responsive breakpoints and dark mode support",
      rules: [authRule],
    })

    expect(result.results[0].status).toBe("NOT_COVERED")
  })

  it("pipeline reports correct layers", async () => {
    const rules = loadLocalRules(FIXTURES_DIR)

    const result = await pipeline.run({
      plan: "Use environment variables for all secrets",
      rules,
    })

    expect(result.layers).toEqual(["keyword", "semantic"])
    expect(result.results.length).toBe(rules.length)
  })
})
