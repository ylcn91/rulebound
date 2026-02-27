import { describe, it, expect } from "vitest"
import { formatGitHubAnnotation } from "./ci.js"

describe("formatGitHubAnnotation", () => {
  it("formats VIOLATED MUST as error annotation", () => {
    const annotation = formatGitHubAnnotation({
      ruleId: "global.no-secrets",
      ruleTitle: "No Hardcoded Secrets",
      severity: "error",
      modality: "must",
      status: "VIOLATED",
      reason: "Plan mentions hardcoded key",
    })
    expect(annotation).toBe("::error::MUST violation: No Hardcoded Secrets - Plan mentions hardcoded key")
  })

  it("formats VIOLATED SHOULD with correct modality", () => {
    const annotation = formatGitHubAnnotation({
      ruleId: "global.testing",
      ruleTitle: "Unit Test Coverage",
      severity: "warning",
      modality: "should",
      status: "VIOLATED",
      reason: "No tests for new module",
    })
    expect(annotation).toBe("::error::SHOULD violation: Unit Test Coverage - No tests for new module")
  })

  it("formats NOT_COVERED as warning annotation", () => {
    const annotation = formatGitHubAnnotation({
      ruleId: "global.testing",
      ruleTitle: "Testing Requirements",
      severity: "warning",
      modality: "should",
      status: "NOT_COVERED",
      reason: "Rule not addressed",
    })
    expect(annotation).toBe("::warning::SHOULD: Testing Requirements - Rule not addressed")
  })

  it("returns empty string for PASS", () => {
    const annotation = formatGitHubAnnotation({
      ruleId: "test",
      ruleTitle: "Test",
      severity: "info",
      modality: "may",
      status: "PASS",
      reason: "OK",
    })
    expect(annotation).toBe("")
  })
})
