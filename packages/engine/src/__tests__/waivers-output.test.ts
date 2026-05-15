import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { validateDeterministic } from "../index.js"
import type { Rule, RuleCheck } from "../index.js"

// ENG-005 — waiver visibility contract.
//
// The CLI emits waived items in two places:
//   - SARIF `runs[].results[].suppressions[]` (formatter in
//     packages/cli/src/commands/check.ts `printSarif`)
//   - PR-markdown `### Waivers applied` (formatter in
//     packages/cli/src/commands/check.ts `renderPrMarkdown`)
//
// Both formatters read engine output: `report.results[*].waived` and
// `report.waiversApplied[]`. This test pins the engine-level data surface
// that drives those outputs. If the surface drifts, CLI formatters break
// silently — this test catches that before the CLI integration tests do.

describe("waiver visibility contract", () => {
  let tmpDir: string
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-waivers-output-"))
  })
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  async function runWithWaiver(): Promise<Awaited<ReturnType<typeof validateDeterministic>>> {
    writeFileSync(join(tmpDir, "app.ts"), "function f() { console.log('x') }\n")
    const checks: RuleCheck[] = [
      { type: "regex", pattern: "console\\.log", files: ["**/*.ts"], severity: "error" },
    ]
    const rule: Rule = {
      id: "demo.no-log",
      title: "No console.log",
      content: "",
      category: "style",
      severity: "error",
      modality: "must",
      tags: [],
      stack: [],
      scope: [],
      changeTypes: [],
      team: [],
      filePath: "demo.md",
      checks,
    }
    return validateDeterministic({
      cwd: tmpDir,
      rules: [rule],
      waivers: [
        {
          rule: "demo.no-log",
          reason: "legacy module, scheduled for refactor",
          owner: "@platform-team",
          expires: "2099-12-31",
        },
      ],
    })
  }

  it("waived result carries the fields SARIF suppressions[] needs", async () => {
    const report = await runWithWaiver()
    const waivedResult = report.results.find((r) => r.waived !== undefined)
    expect(waivedResult).toBeDefined()
    // SARIF `printSarif` reads these directly:
    //   suppressions[].justification = r.waived.reason
    //   suppressions[].properties.expires = r.waived.expires
    expect(waivedResult!.waived?.reason).toBe("legacy module, scheduled for refactor")
    expect(waivedResult!.waived?.expires).toBe("2099-12-31")
    // sarifLevel() downgrades waived violations to "note"; that requires
    // r.waived to be truthy and r.blocking to be false after waiver applied.
    expect(waivedResult!.blocking).toBe(false)
  })

  it("waiversApplied[] carries the fields the PR-markdown 'Waivers applied' table needs", async () => {
    const report = await runWithWaiver()
    expect(report.waiversApplied).toHaveLength(1)
    const applied = report.waiversApplied[0]
    // renderPrMarkdown reads these columns from each non-expired entry:
    //   | Rule | Path | Owner | Expires | Reason |
    expect(applied.waiver.rule).toBe("demo.no-log")
    expect(applied.waiver.owner).toBe("@platform-team")
    expect(applied.waiver.expires).toBe("2099-12-31")
    expect(applied.waiver.reason).toBe("legacy module, scheduled for refactor")
    expect(applied.result.evidence?.filePath).toBe("app.ts")
    expect(applied.expired).toBe(false)
  })

  it("summary.waived counts a non-expired waiver", async () => {
    const report = await runWithWaiver()
    expect(report.summary.waived).toBe(1)
    expect(report.status).toBe("PASSED_WITH_WARNINGS")
  })

  it("expired waivers remain in waiversApplied[] with expired=true so formatters can warn", async () => {
    writeFileSync(join(tmpDir, "app.ts"), "function f() { console.log('x') }\n")
    const checks: RuleCheck[] = [
      { type: "regex", pattern: "console\\.log", files: ["**/*.ts"], severity: "error" },
    ]
    const rule: Rule = {
      id: "demo.no-log",
      title: "No console.log",
      content: "",
      category: "style",
      severity: "error",
      modality: "must",
      tags: [],
      stack: [],
      scope: [],
      changeTypes: [],
      team: [],
      filePath: "demo.md",
      checks,
    }
    const report = await validateDeterministic({
      cwd: tmpDir,
      rules: [rule],
      waivers: [
        {
          rule: "demo.no-log",
          reason: "old waiver",
          owner: "@platform-team",
          expires: "2020-01-01",
        },
      ],
    })
    expect(report.waiversApplied).toHaveLength(1)
    expect(report.waiversApplied[0].expired).toBe(true)
    // Expired waiver does NOT suppress; formatters re-block.
    const violated = report.results.find((r) => r.status === "VIOLATED")
    expect(violated?.blocking).toBe(true)
    expect(violated?.waived).toBeUndefined()
  })
})
