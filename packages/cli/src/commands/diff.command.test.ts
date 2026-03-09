import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { makeRule } from "../__tests__/setup.js"

const {
  loadLocalRulesMock,
  matchRulesByContextMock,
  loadRulesWithInheritanceMock,
  getProjectConfigMock,
  validateWithPipelineMock,
  readGitDiffMock,
  extractAddedLinesMock,
  extractChangedFilesMock,
  recordCliValidationEventMock,
} = vi.hoisted(() => ({
  loadLocalRulesMock: vi.fn(),
  matchRulesByContextMock: vi.fn(),
  loadRulesWithInheritanceMock: vi.fn(),
  getProjectConfigMock: vi.fn(),
  validateWithPipelineMock: vi.fn(),
  readGitDiffMock: vi.fn(),
  extractAddedLinesMock: vi.fn(),
  extractChangedFilesMock: vi.fn(),
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

vi.mock("../lib/git-diff.js", () => ({
  readGitDiff: readGitDiffMock,
  extractAddedLines: extractAddedLinesMock,
  extractChangedFiles: extractChangedFilesMock,
}))

vi.mock("../lib/telemetry.js", () => ({
  recordCliValidationEvent: recordCliValidationEventMock,
}))

import { diffCommand } from "./diff.js"

describe("diffCommand", () => {
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
    readGitDiffMock.mockReset()
    extractAddedLinesMock.mockReset()
    extractChangedFilesMock.mockReset()
    recordCliValidationEventMock.mockReset()
  })

  it("uses explicit staged diff handling and records telemetry", async () => {
    const rules = [makeRule()]
    const report = {
      task: "Diff of staged changes",
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

    readGitDiffMock.mockReturnValue({
      diffText: "diff",
      kind: "staged",
      label: "staged changes",
    })
    extractAddedLinesMock.mockReturnValue("const key = process.env.API_KEY")
    extractChangedFilesMock.mockReturnValue(["src/app.ts"])
    loadRulesWithInheritanceMock.mockReturnValue(rules)
    getProjectConfigMock.mockReturnValue(null)
    matchRulesByContextMock.mockReturnValue(rules)
    validateWithPipelineMock.mockResolvedValue(report)

    await diffCommand({ staged: true, format: "json" })

    expect(readGitDiffMock).toHaveBeenCalledWith({ ref: undefined, staged: true })
    expect(recordCliValidationEventMock).toHaveBeenCalledWith(report, process.cwd())
  })
})
