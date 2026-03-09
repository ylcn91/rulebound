import { afterEach, describe, expect, it, vi } from "vitest"
import { makeRule } from "../__tests__/setup.js"

const { recordCliValidationEventMock } = vi.hoisted(() => ({
  recordCliValidationEventMock: vi.fn(),
}))

vi.mock("../lib/telemetry.js", () => ({
  recordCliValidationEvent: recordCliValidationEventMock,
}))

import { runRuleValidation } from "./watch.js"

describe("runRuleValidation", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    recordCliValidationEventMock.mockReset()
  })

  it("records telemetry for watch validations", async () => {
    const rules = [makeRule()]
    const report = {
      task: "watched file",
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

    const findRulesDir = vi.fn().mockReturnValue("/tmp/rules")
    const loadLocalRules = vi.fn().mockReturnValue(rules)
    const validate = vi.fn().mockResolvedValue(report)

    await runRuleValidation("const apiKey = process.env.API_KEY", "src/app.ts", "/tmp/project", "json", findRulesDir, loadLocalRules, validate)

    expect(recordCliValidationEventMock).toHaveBeenCalledWith(report, "/tmp/project")
  })
})
