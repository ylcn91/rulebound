import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { makeRule } from "../__tests__/setup.js"

const {
  execFileSyncMock,
  loadLocalRulesMock,
  matchRulesByContextMock,
  loadRulesWithInheritanceMock,
  getProjectConfigMock,
  loadConfigMock,
  validateWithPipelineMock,
  extractAddedLinesMock,
  extractChangedFilesMock,
  recordCliValidationEventMock,
} = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
  loadLocalRulesMock: vi.fn(),
  matchRulesByContextMock: vi.fn(),
  loadRulesWithInheritanceMock: vi.fn(),
  getProjectConfigMock: vi.fn(),
  loadConfigMock: vi.fn(),
  validateWithPipelineMock: vi.fn(),
  extractAddedLinesMock: vi.fn(),
  extractChangedFilesMock: vi.fn(),
  recordCliValidationEventMock: vi.fn(),
}))

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}))

vi.mock("../lib/local-rules.js", () => ({
  loadLocalRules: loadLocalRulesMock,
  matchRulesByContext: matchRulesByContextMock,
}))

vi.mock("../lib/inheritance.js", () => ({
  loadRulesWithInheritance: loadRulesWithInheritanceMock,
  getProjectConfig: getProjectConfigMock,
  loadConfig: loadConfigMock,
}))

vi.mock("../lib/validation.js", () => ({
  validateWithPipeline: validateWithPipelineMock,
}))

vi.mock("../lib/git-diff.js", () => ({
  extractAddedLines: extractAddedLinesMock,
  extractChangedFiles: extractChangedFilesMock,
}))

vi.mock("../lib/telemetry.js", () => ({
  recordCliValidationEvent: recordCliValidationEventMock,
}))

import { ciCommand } from "./ci.js"

describe("ciCommand telemetry", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    execFileSyncMock.mockReset()
    loadLocalRulesMock.mockReset()
    matchRulesByContextMock.mockReset()
    loadRulesWithInheritanceMock.mockReset()
    getProjectConfigMock.mockReset()
    loadConfigMock.mockReset()
    validateWithPipelineMock.mockReset()
    extractAddedLinesMock.mockReset()
    extractChangedFilesMock.mockReset()
    recordCliValidationEventMock.mockReset()
  })

  it("records telemetry before exiting", async () => {
    const rules = [makeRule()]
    const report = {
      task: "CI diff against main",
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

    execFileSyncMock.mockReturnValue("diff")
    loadRulesWithInheritanceMock.mockReturnValue(rules)
    getProjectConfigMock.mockReturnValue(null)
    loadConfigMock.mockReturnValue(undefined)
    extractAddedLinesMock.mockReturnValue("const key = process.env.API_KEY")
    extractChangedFilesMock.mockReturnValue(["src/app.ts"])
    matchRulesByContextMock.mockReturnValue(rules)
    validateWithPipelineMock.mockResolvedValue(report)

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`)
    }) as typeof process.exit)

    await expect(ciCommand({ format: "json" })).rejects.toThrow("process.exit:0")

    expect(exitSpy).toHaveBeenCalledWith(0)
    expect(recordCliValidationEventMock).toHaveBeenCalledWith(report, process.cwd())
  })
})
