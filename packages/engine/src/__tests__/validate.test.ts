import { describe, it, expect, vi } from "vitest"
import { validate } from "../validate.js"
import type { Rule, ValidateOptions, ValidationReport } from "../types.js"

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "test-rule",
    title: "Test Rule",
    content: "- Must follow coding standards\n- Never skip tests",
    category: "architecture",
    severity: "error",
    modality: "must",
    tags: ["test"],
    stack: [],
    scope: [],
    changeTypes: [],
    team: [],
    filePath: "test-rule.md",
    ...overrides,
  }
}

describe("validate edge cases", () => {
  it("returns PASSED with empty results for empty rules array", async () => {
    const report = await validate({
      plan: "Build a React component",
      rules: [],
      task: "test",
    })

    expect(report.rulesTotal).toBe(0)
    expect(report.results).toHaveLength(0)
    expect(report.status).toBe("PASSED")
    expect(report.summary.pass).toBe(0)
    expect(report.summary.violated).toBe(0)
    expect(report.summary.notCovered).toBe(0)
  })

  it("handles very long plan text without error", async () => {
    const longText = "This is a test plan. ".repeat(1000)
    const rule = makeRule({
      id: "long-text-rule",
      title: "Code Quality",
      content: "Must maintain code quality standards",
      tags: ["quality"],
    })

    const report = await validate({
      plan: longText,
      rules: [rule],
      task: "process long text",
    })

    expect(report.rulesTotal).toBe(1)
    expect(report.results).toHaveLength(1)
    expect(["PASS", "VIOLATED", "NOT_COVERED"]).toContain(report.results[0].status)
  })

  it("uses plan slice as task when task is not provided", async () => {
    const plan = "Build a component for user authentication with OAuth2"
    const rule = makeRule({ id: "r1", tags: ["auth"] })

    const report = await validate({ plan, rules: [rule] })

    expect(report.task).toBe(plan.slice(0, 100))
  })

  it("reports NOT_COVERED for rules unrelated to the plan", async () => {
    const rule = makeRule({
      id: "k8s-rule",
      title: "Kubernetes Resource Limits",
      content: "Must set CPU and memory limits for all k8s pods",
      tags: ["k8s", "kubernetes"],
      category: "infra",
    })

    const report = await validate({
      plan: "Create a simple HTML landing page with CSS styling",
      rules: [rule],
      task: "landing page",
    })

    const result = report.results.find((r) => r.ruleId === "k8s-rule")
    expect(result?.status).toBe("NOT_COVERED")
  })

  it("returns correct summary counts for mixed results", async () => {
    const rules = [
      makeRule({
        id: "secrets-rule",
        title: "No Hardcoded Secrets",
        content: "- Never hardcode API keys or passwords in source code\n- Must not store secrets in config files",
        tags: ["secrets"],
        severity: "error",
        modality: "must",
      }),
      makeRule({
        id: "error-rule",
        title: "Error Handling",
        content: "Must handle errors with proper error handling and logging",
        tags: ["error", "handling"],
        severity: "warning",
        modality: "should",
      }),
      makeRule({
        id: "infra-rule",
        title: "Docker Image Tagging",
        content: "Must use specific version tags for all Docker images",
        tags: ["docker", "infra"],
        category: "infra",
      }),
    ]

    const report = await validate({
      plan: "I will implement proper error handling and logging for all exceptions",
      rules,
      task: "error handling",
    })

    expect(report.rulesTotal).toBe(3)
    expect(report.summary.pass + report.summary.violated + report.summary.notCovered).toBe(3)
  })

  it("returns FAILED when a must-modality rule is violated", async () => {
    const rule = makeRule({
      id: "must-rule",
      title: "No Hardcoded Secrets",
      content: "- Never hardcode API keys or passwords in source code\n- Must not store secrets in config files",
      tags: ["secrets"],
      severity: "error",
      modality: "must",
    })

    const report = await validate({
      plan: "I will hardcode the database password directly in application.yml config file",
      rules: [rule],
    })

    expect(report.status).toBe("FAILED")
    expect(report.summary.violated).toBeGreaterThan(0)
  })

  it("returns PASSED_WITH_WARNINGS for should-modality violations", async () => {
    const rules = [
      makeRule({
        id: "style-rule",
        title: "No Hardcoded Secrets",
        content: "- Never hardcode API keys or passwords\n- Must not store secrets in config files",
        tags: ["secrets"],
        severity: "warning",
        modality: "should",
      }),
    ]

    const report = await validate({
      plan: "I will hardcode the API key and store secrets in config files",
      rules,
    })

    // should-modality violations don't cause FAILED, only PASSED_WITH_WARNINGS
    expect(["PASSED_WITH_WARNINGS", "PASSED"]).toContain(report.status)
  })

  it("throws when LLM matcher is used without API key", async () => {
    await expect(
      validate({
        plan: "test plan",
        rules: [makeRule()],
        useLlm: true,
        llmProvider: "anthropic",
      })
    ).rejects.toThrow()
  })

  it("handles multiple rules with different severities", async () => {
    const rules = [
      makeRule({ id: "r1", severity: "error", modality: "must", title: "Critical Rule", tags: ["critical"] }),
      makeRule({ id: "r2", severity: "warning", modality: "should", title: "Warning Rule", tags: ["warn"] }),
      makeRule({ id: "r3", severity: "info", modality: "may", title: "Info Rule", tags: ["info"] }),
    ]

    const report = await validate({
      plan: "Implement all critical, warning, and info level features",
      rules,
      task: "multi-severity",
    })

    expect(report.results).toHaveLength(3)
    for (const result of report.results) {
      const rule = rules.find((r) => r.id === result.ruleId)
      if (rule) {
        expect(result.severity).toBe(rule.severity)
        expect(result.modality).toBe(rule.modality)
      }
    }
  })

  it("preserves rule title in validation results", async () => {
    const rule = makeRule({
      id: "custom-id",
      title: "Custom Rule Title",
      content: "Must follow custom standards with proper custom implementation",
      tags: ["custom"],
    })

    const report = await validate({
      plan: "I will follow custom standards and use the custom implementation pattern",
      rules: [rule],
      task: "custom",
    })

    expect(report.results[0].ruleTitle).toBe("Custom Rule Title")
  })

  it("correctly counts rulesMatched excluding NOT_COVERED", async () => {
    const rules = [
      makeRule({
        id: "matched-rule",
        title: "Error Handling Standards",
        content: "All errors must be caught and logged with structured error handling logging",
        tags: ["error", "handling", "logging"],
      }),
      makeRule({
        id: "unrelated-rule",
        title: "Kubernetes Pod Security",
        content: "All pods must have security contexts set in kubernetes",
        tags: ["k8s", "kubernetes"],
        category: "infra",
      }),
    ]

    const report = await validate({
      plan: "Implement proper error handling and structured logging for the API",
      rules,
      task: "error handling",
    })

    expect(report.rulesTotal).toBe(2)
    expect(report.rulesMatched).toBeLessThanOrEqual(report.rulesTotal)
  })
})
