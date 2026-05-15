import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  findRulesDir,
  loadRulesWithInheritance,
  validateDeterministic,
} from "@rulebound/engine"
import { runDeterministicChecks } from "../deterministic-tools.js"

/**
 * MCP-001 — CLI/MCP deterministic parity.
 *
 * Invariant: MCP's `runDeterministicChecks` is a *projection* of the engine's
 * `validateDeterministic` report. The CLI (`rulebound check`) also calls
 * `validateDeterministic` and emits its full shape via --format json. The
 * projection must:
 *
 *  1. Carry the engine `summary` verbatim (same keys, same numbers).
 *  2. Carry `ruleStatuses` verbatim.
 *  3. Carry `parseErrors` verbatim.
 *  4. Slice `results` down to a `topViolations` array of up to 5 entries.
 *  5. Use the same `status` enum (PASSED | FAILED | PASSED_WITH_WARNINGS).
 *
 * If these break, agents and CI consumers will see a contract drift between
 * the CLI gate and the MCP advisory loop — exactly the failure mode AMP-91
 * §UC-3 is designed to prevent.
 */

let tmpDir: string

function rule(name: string, body: string): { path: string; content: string } {
  return {
    path: `${name}.md`,
    content: body,
  }
}

const FIXTURES = [
  rule(
    "require-readme",
    `---
title: Require README
category: docs
severity: error
modality: must
---

Every repo must ship a README.md.

\`\`\`rulebound
checks:
  - type: file-exists
    id: readme-required
    path: README.md
    severity: error
    message: README.md missing
\`\`\`
`,
  ),
  rule(
    "no-debug-statements",
    `---
title: No debugger Statements
category: code
severity: error
modality: must
---

\`\`\`rulebound
checks:
  - type: regex
    id: no-debugger
    pattern: debugger
    flags: g
    forbidden: true
    severity: error
\`\`\`
`,
  ),
  rule(
    "advisory-only",
    `---
title: Advisory Rule (no checks)
category: docs
severity: warning
modality: should
---

Prose-only rule, advisory by design.
`,
  ),
]

function buildFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "rulebound-mcp-parity-"))
  const rulesDir = join(dir, ".rulebound", "rules")
  mkdirSync(rulesDir, { recursive: true })
  for (const r of FIXTURES) {
    writeFileSync(join(rulesDir, r.path), r.content, "utf-8")
  }
  return dir
}

beforeEach(() => {
  tmpDir = buildFixture()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

async function runCliEngine() {
  const rulesDir = findRulesDir(tmpDir)
  if (!rulesDir) throw new Error("findRulesDir returned null in fixture")
  const rules = loadRulesWithInheritance(tmpDir)
  const report = await validateDeterministic({
    cwd: tmpDir,
    rules,
    allowCommandExecution: false,
  })
  return { report, rulesEvaluated: rules.filter((r) => r.checks && r.checks.length > 0).length }
}

describe("CLI ↔ MCP parity (same fixture, two invocation paths)", () => {
  it("summary fields are identical", async () => {
    const { report: cliReport } = await runCliEngine()
    const mcp = await runDeterministicChecks({ cwd: tmpDir })

    // Same keys, same numbers.
    expect(mcp.summary).toEqual(cliReport.summary)
  })

  it("status matches between CLI engine and MCP projection", async () => {
    const { report: cliReport } = await runCliEngine()
    const mcp = await runDeterministicChecks({ cwd: tmpDir })
    expect(mcp.status).toBe(cliReport.status)
    // Sanity check: with 2 blocking rules failing and 1 advisory, status must be FAILED.
    expect(mcp.status).toBe("FAILED")
  })

  it("ruleStatuses are carried verbatim", async () => {
    const { report: cliReport } = await runCliEngine()
    const mcp = await runDeterministicChecks({ cwd: tmpDir })
    expect(mcp.ruleStatuses).toEqual(cliReport.ruleStatuses)
  })

  it("parseErrors are carried verbatim", async () => {
    const { report: cliReport } = await runCliEngine()
    const mcp = await runDeterministicChecks({ cwd: tmpDir })
    expect(mcp.parseErrors).toEqual(cliReport.parseErrors)
  })

  it("topViolations is a strict projection of CLI report.results", async () => {
    const { report: cliReport } = await runCliEngine()
    const mcp = await runDeterministicChecks({ cwd: tmpDir })

    // Every topViolation must correspond to a VIOLATED or ERROR result in the
    // CLI report, identified by (ruleId, checkId).
    const offenders = cliReport.results.filter(
      (r) => r.status === "VIOLATED" || r.status === "ERROR",
    )
    expect(mcp.topViolations.length).toBeLessThanOrEqual(5)
    expect(mcp.topViolations.length).toBeLessThanOrEqual(offenders.length)

    for (const tv of mcp.topViolations) {
      const cliMatch = offenders.find(
        (r) => r.ruleId === tv.ruleId && r.checkId === tv.checkId,
      )
      expect(cliMatch, `top violation ${tv.ruleId}/${tv.checkId} missing in CLI report`).toBeDefined()
      // Source must match.
      expect(tv.source).toBe(cliMatch!.source)
      // Reason must be carried verbatim.
      expect(tv.reason).toBe(cliMatch!.reason)
      // Blocking flag mirrors CLI.
      expect(tv.blocking).toBe(cliMatch!.blocking)
    }
  })

  it("rulesEvaluated equals the count of rules with checks (CLI engine perspective)", async () => {
    const { report: cliReport, rulesEvaluated } = await runCliEngine()
    const mcp = await runDeterministicChecks({ cwd: tmpDir })
    expect(mcp.rulesEvaluated).toBe(rulesEvaluated)
    // Sanity: advisory-only rule has no checks → 2 rules evaluated.
    expect(mcp.rulesEvaluated).toBe(2)
    // CLI summary.total counts result entries; MCP rulesEvaluated counts rules.
    // They can differ (a rule may have multiple checks). Pin the relationship:
    expect(cliReport.summary.total).toBeGreaterThanOrEqual(mcp.rulesEvaluated)
  })

  it("GREEN path: a clean fixture produces identical PASSED summaries on both sides", async () => {
    // Add the missing README so the require-readme rule passes.
    writeFileSync(join(tmpDir, "README.md"), "# hi\n")
    // Remove the no-debugger rule (no source files to scan in the fixture
    // means it would also pass, but explicit is better than implicit).
    rmSync(join(tmpDir, ".rulebound", "rules", "no-debug-statements.md"))

    const { report: cliReport } = await runCliEngine()
    const mcp = await runDeterministicChecks({ cwd: tmpDir })

    expect(cliReport.status).toBe("PASSED")
    expect(mcp.status).toBe(cliReport.status)
    expect(mcp.summary).toEqual(cliReport.summary)
    expect(mcp.topViolations).toEqual([])
  })

  it("changedFiles narrows the diff-evidence rules identically on both sides", async () => {
    // Diff-evidence rule that requires migrations when schema changes.
    writeFileSync(
      join(tmpDir, ".rulebound", "rules", "schema-needs-migration.md"),
      `---
title: Schema changes need migrations
checks:
  - type: diff-evidence
    when_changed:
      - "src/schema.ts"
    require_changed:
      - "migrations/**/*.sql"
---
`,
    )

    const changedFiles = ["src/schema.ts"]

    const rules = loadRulesWithInheritance(tmpDir)
    const cliReport = await validateDeterministic({
      cwd: tmpDir,
      rules,
      changedFiles,
      allowCommandExecution: false,
    })
    const mcp = await runDeterministicChecks({ cwd: tmpDir, changedFiles })

    expect(mcp.summary).toEqual(cliReport.summary)
    expect(mcp.status).toBe(cliReport.status)

    // The schema-needs-migration rule should have triggered.
    const triggered = mcp.topViolations.find((tv) => tv.ruleId === "schema-needs-migration")
    expect(triggered).toBeDefined()
  })
})
