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
  buildEnforcementSummary,
  recordGatewayValidationTelemetry,
  shouldBlockForMode,
  type GatewayViolation,
} from "../interceptor/enforcement.js"

const mockRecordValidationEvent = vi.mocked(recordValidationEvent)

function makeReport(overrides: Partial<import("@rulebound/engine").ValidationReport> = {}): import("@rulebound/engine").ValidationReport {
  return {
    task: "test",
    rulesMatched: 1,
    rulesTotal: 1,
    results: [],
    summary: { pass: 0, violated: 0, notCovered: 0 },
    status: "PASSED",
    ...overrides,
  }
}

describe("gateway enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("distinguishes advisory, moderate, and strict for should-only violations", () => {
    const summary = buildEnforcementSummary(makeReport({
      results: [
        {
          ruleId: "style.rule",
          ruleTitle: "Style Rule",
          severity: "warning",
          modality: "should",
          status: "VIOLATED",
          reason: "Minor issue",
        },
      ],
      summary: { pass: 0, violated: 1, notCovered: 0 },
      status: "PASSED_WITH_WARNINGS",
    }), [])

    expect(summary.hasMustViolation).toBe(false)
    expect(summary.hasShouldViolation).toBe(true)
    expect(summary.score).toBe(0)
    expect(shouldBlockForMode("advisory", summary)).toBe(false)
    expect(shouldBlockForMode("moderate", summary)).toBe(true)
    expect(shouldBlockForMode("strict", summary)).toBe(true)
  })

  it("treats AST errors as MUST-level and warnings as SHOULD-level with penalties", () => {
    const summary = buildEnforcementSummary(makeReport({
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
        ruleId: "ts-no-eval",
        ruleTitle: "No eval",
        severity: "error",
        reason: "AST pattern: eval() detected",
        line: 1,
        codeSnippet: "eval('x')",
      },
      {
        ruleId: "ts-no-any",
        ruleTitle: "No any",
        severity: "warning",
        reason: "AST pattern: avoid any",
        line: 1,
        codeSnippet: "any",
      },
    ])

    expect(summary.hasMustViolation).toBe(true)
    expect(summary.hasShouldViolation).toBe(true)
    expect(summary.semanticScore).toBe(100)
    expect(summary.score).toBe(70)
    expect(shouldBlockForMode("moderate", summary)).toBe(true)
  })

  it("lets advisory continue when score stays above the threshold after AST warnings", () => {
    const summary = buildEnforcementSummary(makeReport({
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
        ruleId: "ts-no-any",
        ruleTitle: "No any",
        severity: "warning",
        reason: "AST pattern: avoid any",
        line: 1,
        codeSnippet: "any",
      },
    ])

    expect(summary.score).toBe(90)
    expect(shouldBlockForMode("advisory", summary)).toBe(false)
    expect(shouldBlockForMode("moderate", summary)).toBe(false)
    expect(shouldBlockForMode("strict", summary)).toBe(true)
  })

  it("records telemetry with gateway source and score", () => {
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
    const violations: GatewayViolation[] = [
      {
        ruleId: "security.no-secrets",
        ruleTitle: "No Secrets",
        severity: "error",
        reason: "Secret found",
        codeSnippet: "const secret = 'x'",
        source: "semantic",
        modality: "must",
      },
    ]
    const enforcement = buildEnforcementSummary(report, [])

    recordGatewayValidationTelemetry({
      report,
      violations,
      enforcement,
      rulesTotal: 2,
      task: "Gateway validation",
      project: "rulebound",
    })

    expect(mockRecordValidationEvent).toHaveBeenCalledOnce()
    expect(mockRecordValidationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "gateway",
        score: 50,
        violated: ["security.no-secrets"],
        passed: ["style.clean"],
        project: "rulebound",
      }),
      expect.any(String),
    )
  })
})
