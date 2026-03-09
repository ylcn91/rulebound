import { describe, it, expect } from "vitest"
import {
  validate,
  shouldBlock,
  shouldWarn,
  shouldSuggestPromotion,
  calculateScore,
  isValidMode,
  DEFAULT_ENFORCEMENT,
  matchRulesByContext,
  filterRules,
  detectLanguageFromCode,
  KeywordMatcher,
  SemanticMatcher,
  ValidationPipeline,
} from "../index.js"
import type { EnforcementConfig, Matcher, Rule, ValidationResult } from "../types.js"

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "test-rule",
    title: "Test Rule",
    content: "- Must use constructor injection\n- Never use field injection",
    category: "architecture",
    severity: "error",
    modality: "must",
    tags: ["di", "injection"],
    stack: [],
    scope: [],
    changeTypes: [],
    team: [],
    filePath: "test-rule.md",
    ...overrides,
  }
}

describe("enforcement", () => {
  it("advisory mode never blocks", () => {
    const config: EnforcementConfig = { mode: "advisory", scoreThreshold: 70, autoPromote: true }
    expect(shouldBlock(config, { hasMustViolation: true, score: 0 })).toBe(false)
  })

  it("moderate mode blocks on must violation", () => {
    const config: EnforcementConfig = { mode: "moderate", scoreThreshold: 70, autoPromote: true }
    expect(shouldBlock(config, { hasMustViolation: true, score: 80 })).toBe(true)
  })

  it("moderate mode blocks on low score", () => {
    const config: EnforcementConfig = { mode: "moderate", scoreThreshold: 70, autoPromote: true }
    expect(shouldBlock(config, { hasMustViolation: false, score: 50 })).toBe(true)
  })

  it("strict mode blocks on should violation", () => {
    const config: EnforcementConfig = { mode: "strict", scoreThreshold: 70, autoPromote: true }
    expect(shouldBlock(config, { hasMustViolation: false, hasShouldViolation: true, score: 80 })).toBe(true)
  })

  it("shouldWarn only in strict mode", () => {
    expect(shouldWarn({ mode: "strict", scoreThreshold: 70, autoPromote: true }, true)).toBe(true)
    expect(shouldWarn({ mode: "moderate", scoreThreshold: 70, autoPromote: true }, true)).toBe(false)
  })

  it("shouldSuggestPromotion when score >= 90 and not strict", () => {
    expect(shouldSuggestPromotion({ mode: "advisory", scoreThreshold: 70, autoPromote: true }, 90)).toBe(true)
    expect(shouldSuggestPromotion({ mode: "strict", scoreThreshold: 70, autoPromote: true }, 95)).toBe(false)
  })

  it("calculateScore returns 100 for all pass", () => {
    const results = [{ status: "PASS" }, { status: "PASS" }, { status: "PASS" }]
    expect(calculateScore(results)).toBe(100)
  })

  it("calculateScore handles mixed results", () => {
    const results = [{ status: "PASS" }, { status: "NOT_COVERED" }, { status: "VIOLATED" }]
    expect(calculateScore(results)).toBe(50)
  })

  it("isValidMode validates correctly", () => {
    expect(isValidMode("advisory")).toBe(true)
    expect(isValidMode("moderate")).toBe(true)
    expect(isValidMode("strict")).toBe(true)
    expect(isValidMode("invalid")).toBe(false)
  })
})

describe("KeywordMatcher", () => {
  it("detects violation when plan contradicts prohibition", async () => {
    const matcher = new KeywordMatcher()
    const rule = makeRule({
      title: "No Hardcoded Secrets",
      content: "- Never hardcode API keys or passwords in source code\n- Must not store secrets in config files\n- Use environment variables for all credentials",
      tags: ["secrets", "security"],
    })
    const results = await matcher.match({
      plan: "I will store secrets in the config file for convenience",
      rules: [rule],
    })
    expect(results[0].status).toBe("VIOLATED")
  })

  it("detects pass when plan addresses rule", async () => {
    const matcher = new KeywordMatcher()
    const rule = makeRule({
      title: "Error Handling Requirements",
      content: "- Must handle all errors properly\n- Always log errors with context",
      tags: ["error", "logging", "handling"],
      category: "architecture",
    })
    const results = await matcher.match({
      plan: "Implement proper error handling and logging for all architecture layers",
      rules: [rule],
    })
    expect(results[0].status).toBe("PASS")
  })

  it("reports not covered when plan is unrelated", async () => {
    const matcher = new KeywordMatcher()
    const rule = makeRule({
      title: "Kubernetes Resource Limits",
      content: "- Must set CPU and memory limits",
      tags: ["k8s"],
      category: "infra",
    })
    const results = await matcher.match({
      plan: "Create a React component for the login form",
      rules: [rule],
    })
    expect(results[0].status).toBe("NOT_COVERED")
  })
})

describe("SemanticMatcher", () => {
  it("finds similarity for related content", async () => {
    const matcher = new SemanticMatcher()
    const rule = makeRule({
      title: "Error Handling Standards",
      content: "All errors must be caught and logged with structured logging",
      tags: ["error", "logging"],
    })
    const results = await matcher.match({
      plan: "Implement proper error handling with structured logging for all API endpoints",
      rules: [rule],
    })
    expect(results[0].status).toBe("PASS")
    expect(results[0].confidence).toBeGreaterThan(0.5)
  })
})

describe("ValidationPipeline", () => {
  it("merges results from multiple matchers", async () => {
    const pipeline = new ValidationPipeline([new KeywordMatcher(), new SemanticMatcher()])
    const rule = makeRule({
      title: "Test Coverage",
      content: "- Must have 80% test coverage\n- Always write unit tests",
      tags: ["testing", "coverage"],
    })
    const result = await pipeline.run({
      plan: "Write comprehensive unit tests with 80% coverage for the testing module",
      rules: [rule],
    })
    expect(result.layers).toEqual(["keyword", "semantic"])
    expect(result.results).toHaveLength(1)
  })

  it("preserves violations over higher-confidence pass results", async () => {
    const rule = makeRule({ id: "boundary.rule" })
    const keywordMatcher: Matcher = {
      name: "keyword",
      match: async () => [{
        ruleId: rule.id,
        status: "VIOLATED",
        confidence: 0.55,
        reason: "Keyword matcher found a direct contradiction",
        suggestedFix: "Stay inside the boundary",
      }],
    }
    const semanticMatcher: Matcher = {
      name: "semantic",
      match: async () => [{
        ruleId: rule.id,
        status: "PASS",
        confidence: 0.92,
        reason: "Semantic matcher sees related language",
      }],
    }

    const pipeline = new ValidationPipeline([keywordMatcher, semanticMatcher])
    const result = await pipeline.run({ plan: "test", rules: [rule] })

    expect(result.results).toEqual([
      {
        ruleId: rule.id,
        status: "VIOLATED",
        confidence: 0.55,
        reason: "Keyword matcher found a direct contradiction",
        suggestedFix: "Stay inside the boundary",
      },
    ])
  })
})

describe("validate", () => {
  it("returns full validation report", async () => {
    const rules = [
      makeRule({ id: "rule-1", title: "No Hardcoded Secrets", content: "Never hardcode secrets", tags: ["secrets"] }),
      makeRule({ id: "rule-2", title: "Error Handling", content: "Must handle errors", tags: ["error"], severity: "warning", modality: "should" }),
    ]
    const report = await validate({
      plan: "I will load secrets from environment variables and handle all errors",
      rules,
      task: "test",
    })
    expect(report.rulesTotal).toBe(2)
    expect(report.summary).toBeDefined()
    expect(["PASSED", "PASSED_WITH_WARNINGS", "FAILED"]).toContain(report.status)
  })

  it("returns FAILED on must violation", async () => {
    const rule = makeRule({
      id: "must-rule",
      modality: "must",
      title: "No Hardcoded Secrets",
      content: "- Never hardcode API keys or passwords in source code\n- Must not store secrets in config files",
      tags: ["secrets"],
    })
    const report = await validate({
      plan: "I will hardcode the database password directly in application.yml config file",
      rules: [rule],
    })
    expect(report.status).toBe("FAILED")
  })
})

describe("matchRulesByContext", () => {
  it("returns all rules when no project config", () => {
    const rules = [
      makeRule({ id: "r1", stack: [] }),
      makeRule({ id: "r2", stack: ["java"] }),
    ]
    const matched = matchRulesByContext(rules, null)
    expect(matched).toHaveLength(2)
  })

  it("filters by stack", () => {
    const rules = [
      makeRule({ id: "global", stack: [] }),
      makeRule({ id: "java-only", stack: ["java"] }),
      makeRule({ id: "python-only", stack: ["python"] }),
    ]
    const matched = matchRulesByContext(rules, { stack: ["java"] })
    expect(matched.map((r) => r.id)).toContain("global")
    expect(matched.map((r) => r.id)).toContain("java-only")
    expect(matched.map((r) => r.id)).not.toContain("python-only")
  })
})

describe("filterRules", () => {
  it("filters by category", () => {
    const rules = [
      makeRule({ id: "r1", category: "security" }),
      makeRule({ id: "r2", category: "style" }),
    ]
    const filtered = filterRules(rules, { category: "security" })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("r1")
  })

  it("filters by stack", () => {
    const rules = [
      makeRule({ id: "r1", stack: ["java"] }),
      makeRule({ id: "r2", stack: ["python"] }),
      makeRule({ id: "r3", stack: [] }),
    ]
    const filtered = filterRules(rules, { stack: "java" })
    expect(filtered.map((r) => r.id)).toContain("r1")
    expect(filtered.map((r) => r.id)).toContain("r3")
    expect(filtered.map((r) => r.id)).not.toContain("r2")
  })
})

describe("detectLanguageFromCode", () => {
  it("detects from file extension", () => {
    expect(detectLanguageFromCode("", "App.java")).toBe("java")
    expect(detectLanguageFromCode("", "main.go")).toBe("go")
    expect(detectLanguageFromCode("", "app.py")).toBe("python")
    expect(detectLanguageFromCode("", "index.ts")).toBe("typescript")
  })

  it("detects from code content", () => {
    expect(detectLanguageFromCode("public class Foo {}")).toBe("java")
    expect(detectLanguageFromCode("func main() {\npackage main")).toBe("go")
    expect(detectLanguageFromCode("def hello():\n  self.x = 1\nimport os")).toBe("python")
  })
})
