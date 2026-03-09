import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@rulebound/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rulebound/engine")>()
  return {
    ...actual,
    recordValidationEvent: vi.fn(),
  }
})

import { recordValidationEvent } from "@rulebound/engine"
import {
  buildValidationEnforcementSummary,
  buildValidationViolations,
  recordMcpValidationTelemetry,
  shouldBlockValidation,
} from "../validation.js"
import type { ValidationReport } from "../types.js"

const mockRecordValidationEvent = vi.mocked(recordValidationEvent)

function makeReport(overrides: Partial<ValidationReport> = {}): ValidationReport {
  return {
    task: "test",
    rulesTotal: 1,
    results: [],
    summary: { pass: 0, violated: 0, notCovered: 0 },
    status: "PASSED",
    ...overrides,
  }
}

describe("mcp validation helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("maps AST warnings to SHOULD-level and keeps moderate below the block threshold", () => {
    const report = makeReport({
      results: [
        {
          ruleId: "semantic.clean",
          ruleTitle: "Semantic Clean",
          severity: "warning",
          modality: "should",
          status: "PASS",
          reason: "Clean",
        },
      ],
      summary: { pass: 1, violated: 0, notCovered: 0 },
    })

    const summary = buildValidationEnforcementSummary(report, [
      {
        rule: "ts-no-any",
        line: 1,
        message: "Avoid any",
        severity: "warning",
      },
    ])

    expect(summary.hasMustViolation).toBe(false)
    expect(summary.hasShouldViolation).toBe(true)
    expect(summary.score).toBe(90)
    expect(shouldBlockValidation("moderate", summary)).toBe(false)
    expect(shouldBlockValidation("strict", summary)).toBe(true)
  })

  it("drops the score by 20 per AST error", () => {
    const summary = buildValidationEnforcementSummary(makeReport({
      results: [
        {
          ruleId: "semantic.clean",
          ruleTitle: "Semantic Clean",
          severity: "warning",
          modality: "should",
          status: "PASS",
          reason: "Clean",
        },
      ],
      summary: { pass: 1, violated: 0, notCovered: 0 },
    }), [
      {
        rule: "ts-no-eval",
        line: 1,
        message: "eval() detected",
        severity: "error",
      },
    ])

    expect(summary.hasMustViolation).toBe(true)
    expect(summary.score).toBe(80)
    expect(shouldBlockValidation("moderate", summary)).toBe(true)
  })

  it("builds combined AST and semantic violations", () => {
    const report = makeReport({
      results: [
        {
          ruleId: "security.no-secrets",
          ruleTitle: "No Secrets",
          severity: "error",
          modality: "must",
          status: "VIOLATED",
          reason: "Secret found",
          suggestedFix: "Use env vars",
        },
      ],
      summary: { pass: 0, violated: 1, notCovered: 0 },
      status: "FAILED",
    })

    const violations = buildValidationViolations(report, [
      {
        rule: "ts-no-any",
        line: 1,
        message: "Avoid any",
        severity: "warning",
      },
    ])

    expect(violations).toHaveLength(2)
    expect(violations[0]).toMatchObject({ source: "ast", modality: "should" })
    expect(violations[1]).toMatchObject({ source: "semantic", modality: "must", fix: "Use env vars" })
  })

  it("records telemetry for MCP validations", () => {
    const report = makeReport({
      results: [
        {
          ruleId: "security.no-secrets",
          ruleTitle: "No Secrets",
          severity: "error",
          modality: "must",
          status: "VIOLATED",
          reason: "Secret found",
        },
        {
          ruleId: "style.clean",
          ruleTitle: "Style",
          severity: "warning",
          modality: "should",
          status: "PASS",
          reason: "Clean",
        },
      ],
      summary: { pass: 1, violated: 1, notCovered: 0 },
      status: "FAILED",
    })

    const violations = buildValidationViolations(report, [])
    const enforcement = buildValidationEnforcementSummary(report, [])

    recordMcpValidationTelemetry({
      report,
      violations,
      enforcement,
      rulesTotal: 2,
      task: "validate_before_write:file.ts",
    })

    expect(mockRecordValidationEvent).toHaveBeenCalledOnce()
    expect(mockRecordValidationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "mcp",
        score: 50,
        violated: ["security.no-secrets"],
        passed: ["style.clean"],
      }),
      expect.any(String),
    )
  })
})
