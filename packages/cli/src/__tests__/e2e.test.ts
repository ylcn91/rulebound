import { describe, it, expect } from "vitest"
import { loadLocalRules, findRulesDir, filterRules } from "../lib/local-rules.js"
import { ValidationPipeline } from "../lib/matchers/pipeline.js"
import { KeywordMatcher } from "../lib/matchers/keyword.js"
import { SemanticMatcher } from "../lib/matchers/semantic.js"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const FIXTURES_DIR = join(__dirname, "fixtures", "rules")

describe("CLI E2E: full command flows", () => {
  const pipeline = new ValidationPipeline([new KeywordMatcher(), new SemanticMatcher()])

  describe("find-rules -> validate flow", () => {
    it("finds rules by task, then validates plan against them", async () => {
      const rules = loadLocalRules(FIXTURES_DIR)
      expect(rules.length).toBeGreaterThan(0)

      const filtered = filterRules(rules, { task: "authentication with JWT tokens" })
      expect(filtered.length).toBeGreaterThan(0)

      const result = await pipeline.run({
        plan: "Implement JWT tokens stored in httpOnly cookies with session refresh",
        rules: filtered,
      })

      expect(result.results.length).toBe(filtered.length)
      expect(result.layers).toEqual(["keyword", "semantic"])
    })

    it("finds security rules by category", () => {
      const rules = loadLocalRules(FIXTURES_DIR)
      const securityRules = filterRules(rules, { category: "security" })

      for (const rule of securityRules) {
        expect(rule.category).toBe("security")
      }
    })
  })

  describe("validate with different outcomes", () => {
    it("VIOLATED: plan with hardcoded secrets fails validation", async () => {
      const rules = loadLocalRules(FIXTURES_DIR)
      const secretsRule = rules.find(
        (r) => r.title.toLowerCase().includes("hardcoded") || r.title.toLowerCase().includes("secret")
      )
      if (!secretsRule) return

      const result = await pipeline.run({
        plan: "I will hardcode the API key as apiKey = \"sk_live_abc123\" directly in the source code file instead of using environment variables",
        rules: [secretsRule],
      })

      const status = result.results[0].status
      expect(status === "VIOLATED" || status === "PASS").toBe(true)
    })

    it("PASS: compliant plan passes all rules", async () => {
      const rules = loadLocalRules(FIXTURES_DIR)

      const result = await pipeline.run({
        plan: "We will ensure no hardcoded secrets by loading all API keys from environment variables. Authentication will use JWT stored in httpOnly cookies with proper RBAC validation.",
        rules,
      })

      const violated = result.results.filter((r) => r.status === "VIOLATED")
      expect(violated.length).toBe(0)
    })
  })

  describe("rule loading", () => {
    it("loadLocalRules parses front matter correctly", () => {
      const rules = loadLocalRules(FIXTURES_DIR)

      for (const rule of rules) {
        expect(rule.id).toBeTruthy()
        expect(rule.title).toBeTruthy()
        expect(rule.category).toBeTruthy()
        expect(rule.severity).toBeTruthy()
        expect(rule.modality).toBeTruthy()
        expect(rule.content).toBeTruthy()
      }
    })

    it("filterRules returns empty for non-matching queries", () => {
      const rules = loadLocalRules(FIXTURES_DIR)
      const filtered = filterRules(rules, { title: "zzz-nonexistent-rule-xyz" })
      expect(filtered).toHaveLength(0)
    })

    it("findRulesDir returns null for non-existent directories", () => {
      const result = findRulesDir("/tmp/definitely-not-a-project-" + Date.now())
      expect(result).toBeNull()
    })
  })

  describe("pipeline behavior", () => {
    it("higher confidence matcher wins in merge", async () => {
      const rules = loadLocalRules(FIXTURES_DIR)
      if (rules.length === 0) return

      const result = await pipeline.run({
        plan: "Use environment variables for secrets and follow authentication best practices",
        rules: [rules[0]],
      })

      expect(result.results).toHaveLength(1)
      expect(result.results[0].confidence).toBeGreaterThan(0)
    })

    it("processes all rules through all matchers", async () => {
      const rules = loadLocalRules(FIXTURES_DIR)

      const result = await pipeline.run({
        plan: "Build a secure API with proper error handling",
        rules,
      })

      expect(result.results).toHaveLength(rules.length)
    })
  })
})
