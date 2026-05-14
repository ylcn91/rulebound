import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  runDeterministicChecks,
  checkDiff,
  getRepairInstructions,
  getChangedFilesFromGit,
} from "../deterministic-tools.js"

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), "rulebound-mcp-test-"))
}

function writeRule(rulesDir: string, fileName: string, content: string): void {
  mkdirSync(rulesDir, { recursive: true })
  writeFileSync(join(rulesDir, fileName), content, "utf-8")
}

const REQUIRE_README = `---
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
    description: Add a README.md at the repo root
\`\`\`
`

const FORBID_TODOS = `---
title: No TODO Markers
category: style
severity: warning
modality: should
---

\`\`\`rulebound
checks:
  - type: regex
    id: no-todo
    pattern: TODO
    flags: g
    forbidden: true
    severity: warning
    message: TODO marker found
    description: Resolve TODO or open an issue
\`\`\`
`

describe("runDeterministicChecks", () => {
  let cwd: string

  beforeEach(() => {
    cwd = makeTempProject()
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  it("returns no-op note when no rules directory exists", async () => {
    const result = await runDeterministicChecks({ cwd })
    expect(result.status).toBe("PASSED")
    expect(result.rulesEvaluated).toBe(0)
    expect(result.note).toMatch(/No rules directory/i)
  })

  it("returns note when rules exist but none have checks", async () => {
    const rulesDir = join(cwd, ".rulebound", "rules")
    writeRule(rulesDir, "advisory.md", "---\ntitle: Advisory\n---\n\nJust prose, no checks.\n")
    const result = await runDeterministicChecks({ cwd })
    expect(result.status).toBe("PASSED")
    expect(result.rulesEvaluated).toBe(0)
    expect(result.note).toMatch(/No deterministic checks/i)
  })

  it("flags missing required file as a blocking violation", async () => {
    const rulesDir = join(cwd, ".rulebound", "rules")
    writeRule(rulesDir, "require-readme.md", REQUIRE_README)

    const result = await runDeterministicChecks({ cwd })

    expect(result.status).toBe("FAILED")
    expect(result.summary.violated).toBeGreaterThanOrEqual(1)
    expect(result.summary.blocking).toBeGreaterThanOrEqual(1)
    expect(result.topViolations).toHaveLength(1)

    const violation = result.topViolations[0]
    expect(violation.ruleId).toBe("require-readme")
    expect(violation.reason).toContain("README.md")
    expect(violation.blocking).toBe(true)
    expect(violation.suggestedFix).toMatch(/README/)
    expect(violation.file).toBe("README.md")
  })

  it("passes when the required file is present", async () => {
    const rulesDir = join(cwd, ".rulebound", "rules")
    writeRule(rulesDir, "require-readme.md", REQUIRE_README)
    writeFileSync(join(cwd, "README.md"), "# Hello\n", "utf-8")

    const result = await runDeterministicChecks({ cwd })

    expect(result.status).toBe("PASSED")
    expect(result.summary.violated).toBe(0)
    expect(result.summary.blocking).toBe(0)
    expect(result.topViolations).toHaveLength(0)
  })

  it("caps topViolations at 5 entries", async () => {
    const rulesDir = join(cwd, ".rulebound", "rules")
    writeRule(rulesDir, "no-todo.md", FORBID_TODOS)
    // Seed 7 files with TODO markers
    for (let i = 0; i < 7; i++) {
      writeFileSync(join(cwd, `file${i}.txt`), `something TODO here\n`, "utf-8")
    }

    const result = await runDeterministicChecks({ cwd })
    expect(result.summary.violated).toBeGreaterThanOrEqual(7)
    expect(result.topViolations.length).toBeLessThanOrEqual(5)
  })
})

describe("getRepairInstructions", () => {
  let cwd: string

  beforeEach(() => {
    cwd = makeTempProject()
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  it("returns structured instructions for each violation", async () => {
    const rulesDir = join(cwd, ".rulebound", "rules")
    writeRule(rulesDir, "require-readme.md", REQUIRE_README)

    const result = await getRepairInstructions({ cwd })

    expect(result.status).toBe("FAILED")
    expect(result.totalViolations).toBe(1)
    expect(result.instructions).toHaveLength(1)

    const instruction = result.instructions[0]
    expect(instruction).toMatchObject({
      ruleId: "require-readme",
      file: "README.md",
      source: "file",
      blocking: true,
    })
    expect(instruction.reason).toContain("README.md")
    expect(instruction.suggestedFix).toMatch(/README/)
    expect(instruction.rerunCommand).toMatch(/rulebound run-checks/)
  })

  it("returns an empty instruction set when nothing is broken", async () => {
    const rulesDir = join(cwd, ".rulebound", "rules")
    writeRule(rulesDir, "require-readme.md", REQUIRE_README)
    writeFileSync(join(cwd, "README.md"), "# Ok\n", "utf-8")

    const result = await getRepairInstructions({ cwd })

    expect(result.status).toBe("PASSED")
    expect(result.totalViolations).toBe(0)
    expect(result.instructions).toEqual([])
  })

  it("respects the limit parameter", async () => {
    const rulesDir = join(cwd, ".rulebound", "rules")
    writeRule(rulesDir, "no-todo.md", FORBID_TODOS)
    for (let i = 0; i < 4; i++) {
      writeFileSync(join(cwd, `f${i}.txt`), "TODO\n", "utf-8")
    }

    const result = await getRepairInstructions({ cwd, limit: 2 })
    expect(result.totalViolations).toBeGreaterThanOrEqual(4)
    expect(result.instructions).toHaveLength(2)
  })

  it("includes changed file list in rerunCommand", async () => {
    const rulesDir = join(cwd, ".rulebound", "rules")
    writeRule(rulesDir, "require-readme.md", REQUIRE_README)

    const result = await getRepairInstructions({
      cwd,
      changedFiles: ["src/app.ts", "src/lib.ts"],
    })
    expect(result.instructions[0].rerunCommand).toContain("src/app.ts")
  })
})

describe("checkDiff", () => {
  let cwd: string

  beforeEach(() => {
    cwd = makeTempProject()
  })

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true })
  })

  it("returns PASSED no-op when not a git repo (empty diff)", async () => {
    const rulesDir = join(cwd, ".rulebound", "rules")
    writeRule(rulesDir, "require-readme.md", REQUIRE_README)

    const result = await checkDiff({ cwd })

    expect(result.status).toBe("PASSED")
    expect(result.summary.total).toBe(0)
    expect(result.summary.violated).toBe(0)
    expect(result.note).toMatch(/No changed files/i)
    expect(result.topViolations).toEqual([])
  })

  it("rejects unsafe base refs", async () => {
    const files = getChangedFilesFromGit({ cwd, base: "; rm -rf /" })
    expect(files).toEqual([])
  })
})
