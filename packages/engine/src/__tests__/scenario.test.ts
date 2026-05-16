import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { validateDeterministic, type Rule } from "../index.js"

describe("scenario checks", () => {
  let cwd: string

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "rulebound-scenario-"))
    mkdirSync(join(cwd, "reports", "scenarios"), { recursive: true })
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  function rule(): Rule {
    return {
      id: "scenario.cli-pack-install",
      title: "CLI pack install scenario passes",
      content: "Scenario report must pass.",
      category: "testing",
      severity: "error",
      modality: "must",
      tags: [],
      stack: [],
      scope: [],
      changeTypes: [],
      team: [],
      filePath: "scenario.md",
      checks: [
        {
          type: "scenario",
          id: "cli-pack-install",
          scenario: "cli.pack-install",
          report: "reports/scenarios/cli-pack-install.json",
          max_age_minutes: 60,
          require_assertions: ["exit-code-zero"],
          severity: "error",
        },
      ],
    }
  }

  function writeReport(report: unknown): void {
    writeFileSync(
      join(cwd, "reports", "scenarios", "cli-pack-install.json"),
      JSON.stringify(report),
    )
  }

  it("passes when the external scenario report is fresh and passed", async () => {
    writeReport({
      scenario: "cli.pack-install",
      status: "passed",
      environment: { finishedAt: new Date().toISOString() },
      assertions: [{ id: "exit-code-zero", status: "passed" }],
    })

    const report = await validateDeterministic({ cwd, rules: [rule()] })

    expect(report.status).toBe("PASSED")
    expect(report.results[0]).toMatchObject({
      status: "PASS",
      source: "scenario",
      blocking: false,
    })
  })

  it("blocks when the scenario report is missing", async () => {
    const report = await validateDeterministic({ cwd, rules: [rule()] })

    expect(report.status).toBe("FAILED")
    expect(report.results[0]).toMatchObject({
      status: "ERROR",
      source: "scenario",
      blocking: true,
    })
  })

  it("blocks stale and failed reports", async () => {
    writeReport({
      scenario: "cli.pack-install",
      status: "failed",
      environment: { finishedAt: "2000-01-01T00:00:00.000Z" },
      assertions: [{ id: "exit-code-zero", status: "failed" }],
    })

    const report = await validateDeterministic({ cwd, rules: [rule()] })

    expect(report.status).toBe("FAILED")
    expect(report.results[0].status).toBe("VIOLATED")
    expect(report.results[0].blocking).toBe(true)
  })
})
