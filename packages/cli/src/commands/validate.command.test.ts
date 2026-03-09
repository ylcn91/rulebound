import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { makeRule } from "../__tests__/setup.js"

const {
  loadLocalRulesMock,
  matchRulesByContextMock,
  loadRulesWithInheritanceMock,
  getProjectConfigMock,
  validateWithPipelineMock,
  recordCliValidationEventMock,
} = vi.hoisted(() => ({
  loadLocalRulesMock: vi.fn(),
  matchRulesByContextMock: vi.fn(),
  loadRulesWithInheritanceMock: vi.fn(),
  getProjectConfigMock: vi.fn(),
  validateWithPipelineMock: vi.fn(),
  recordCliValidationEventMock: vi.fn(),
}))

vi.mock("../lib/local-rules.js", () => ({
  loadLocalRules: loadLocalRulesMock,
  matchRulesByContext: matchRulesByContextMock,
}))

vi.mock("../lib/inheritance.js", () => ({
  loadRulesWithInheritance: loadRulesWithInheritanceMock,
  getProjectConfig: getProjectConfigMock,
}))

vi.mock("../lib/validation.js", () => ({
  validateWithPipeline: validateWithPipelineMock,
}))

vi.mock("../lib/telemetry.js", () => ({
  recordCliValidationEvent: recordCliValidationEventMock,
}))

import { validateCommand } from "./validate.js"

describe("validateCommand telemetry", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    loadLocalRulesMock.mockReset()
    matchRulesByContextMock.mockReset()
    loadRulesWithInheritanceMock.mockReset()
    getProjectConfigMock.mockReset()
    validateWithPipelineMock.mockReset()
    recordCliValidationEventMock.mockReset()
  })

  it("records telemetry for validate runs", async () => {
    const rules = [makeRule()]
    const report = {
      task: "Use environment variables",
      rulesMatched: 1,
      rulesTotal: 1,
      results: [
        {
          ruleId: "test.rule",
          ruleTitle: "Test Rule",
          severity: "error",
          modality: "must",
          status: "PASS",
          reason: "Covered",
        },
      ],
      summary: { pass: 1, violated: 0, notCovered: 0 },
      status: "PASSED" as const,
    }

    loadRulesWithInheritanceMock.mockReturnValue(rules)
    getProjectConfigMock.mockReturnValue(null)
    matchRulesByContextMock.mockReturnValue(rules)
    validateWithPipelineMock.mockResolvedValue(report)

    await validateCommand({ plan: "Use environment variables", format: "json" })

    expect(recordCliValidationEventMock).toHaveBeenCalledWith(report, process.cwd())
  })
})
