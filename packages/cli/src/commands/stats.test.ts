import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { statsCommand } from "./stats.js"
import { recordCliValidationEvent } from "../lib/telemetry.js"

describe("statsCommand", () => {
  const originalCwd = process.cwd()
  const originalHome = process.env.HOME
  let tempDir: string
  let tempHome: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rulebound-stats-project-"))
    tempHome = mkdtempSync(join(tmpdir(), "rulebound-stats-home-"))
    process.env.HOME = tempHome
    process.chdir(tempDir)
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.chdir(originalCwd)
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
    rmSync(tempDir, { recursive: true, force: true })
    rmSync(tempHome, { recursive: true, force: true })
  })

  it("reads stats from recorded CLI telemetry events", async () => {
    recordCliValidationEvent(
      {
        task: "validate",
        results: [
          { ruleId: "security.no-secrets", status: "VIOLATED" },
          { ruleId: "style.naming", status: "PASS" },
        ],
      },
      tempDir
    )

    await statsCommand({ format: "json", days: "30" })

    const output = vi.mocked(console.log).mock.calls[0]?.[0]
    expect(typeof output).toBe("string")

    const stats = JSON.parse(output as string)
    expect(stats).toEqual({
      totalValidations: 1,
      averageScore: 50,
      topViolatedRules: [{ ruleId: "security.no-secrets", count: 1 }],
      categoryBreakdown: { security: 1 },
      trendByDay: [
        {
          date: expect.any(String),
          score: 50,
          violations: 1,
        },
      ],
      sourceBreakdown: { cli: 1 },
    })
  })
})
