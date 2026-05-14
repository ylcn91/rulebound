import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { checkCommand } from "../commands/check.js"

describe("check CLI command", () => {
  let tmpDir: string
  let originalCwd: string
  let exitSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalCwd = process.cwd()
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-check-cli-"))
    mkdirSync(join(tmpDir, ".rulebound/rules"), { recursive: true })
    process.chdir(tmpDir)

    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__EXIT__:${code ?? 0}`)
    }) as never)
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tmpDir, { recursive: true, force: true })
    exitSpy.mockRestore()
    logSpy.mockRestore()
    errSpy.mockRestore()
  })

  function writeRule(file: string, body: string): void {
    writeFileSync(join(tmpDir, ".rulebound/rules", file), body)
  }

  async function runAndCapture(opts: Parameters<typeof checkCommand>[0]): Promise<{ code: number; out: string }> {
    let code = -1
    try {
      await checkCommand(opts)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const m = msg.match(/__EXIT__:(\d+)/)
      if (m) code = Number(m[1])
      else throw e
    }
    const out = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n")
    return { code, out }
  }

  it("exits 0 when all deterministic checks pass", async () => {
    writeFileSync(join(tmpDir, "README.md"), "hi")
    writeRule(
      "evidence.md",
      `---
title: Has README
checks:
  - type: file-exists
    path: README.md
---

body
`,
    )
    const { code } = await runAndCapture({ format: "json" })
    expect(code).toBe(0)
  })

  it("exits 1 on deterministic violation", async () => {
    writeRule(
      "evidence.md",
      `---
title: Missing thing
checks:
  - type: file-exists
    path: missing-file.md
    severity: error
---

body
`,
    )
    const { code, out } = await runAndCapture({ format: "json" })
    expect(code).toBe(1)
    const parsed = JSON.parse(out)
    expect(parsed.status).toBe("FAILED")
  })

  it("emits github annotations format", async () => {
    writeRule(
      "evidence.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    const { code, out } = await runAndCapture({ format: "github" })
    expect(code).toBe(1)
    expect(out).toContain("::error")
  })

  it("falls back to origin/<base> for diff-evidence checks in detached CI-style checkouts", async () => {
    mkdirSync(join(tmpDir, "src"), { recursive: true })
    writeFileSync(join(tmpDir, "src/schema.ts"), "export const version = 1\n")
    writeRule(
      "schema-needs-migration.md",
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

    execFileSync("git", ["init", "-b", "feature"], { cwd: tmpDir, stdio: "ignore" })
    execFileSync("git", ["config", "user.email", "test@rulebound.local"], { cwd: tmpDir })
    execFileSync("git", ["config", "user.name", "Rulebound Test"], { cwd: tmpDir })
    execFileSync("git", ["add", "."], { cwd: tmpDir })
    execFileSync("git", ["commit", "-m", "base"], { cwd: tmpDir, stdio: "ignore" })
    execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], { cwd: tmpDir })
    writeFileSync(join(tmpDir, "src/schema.ts"), "export const version = 2\n")
    execFileSync("git", ["add", "src/schema.ts"], { cwd: tmpDir })
    execFileSync("git", ["commit", "-m", "schema change"], { cwd: tmpDir, stdio: "ignore" })

    const { code, out } = await runAndCapture({ format: "json", base: "main" })
    expect(code).toBe(1)
    const parsed = JSON.parse(out)
    expect(parsed.status).toBe("FAILED")
    expect(parsed.results[0].status).toBe("VIOLATED")
  })

  it("repair-json emits failures list with rerun command", async () => {
    writeRule(
      "evidence.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
---
`,
    )
    const { code, out } = await runAndCapture({ format: "repair-json" })
    expect(code).toBe(1)
    const parsed = JSON.parse(out)
    expect(parsed.failures).toHaveLength(1)
    expect(parsed.failures[0].rerun).toContain("rulebound check")
  })

  it("emits SARIF 2.1.0 output for violations", async () => {
    writeRule(
      "evidence.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    const { code, out } = await runAndCapture({ format: "sarif" })
    expect(code).toBe(1)
    const parsed = JSON.parse(out)
    expect(parsed.version).toBe("2.1.0")
    expect(parsed.runs[0].tool.driver.name).toBe("rulebound")
    expect(parsed.runs[0].results.length).toBeGreaterThan(0)
    expect(parsed.runs[0].results[0].level).toBe("error")
  })

  it("exits 2 when no rules present", async () => {
    rmSync(join(tmpDir, ".rulebound/rules"), { recursive: true, force: true })
    const { code } = await runAndCapture({ format: "json" })
    expect(code).toBe(2)
  })

  it("waived violation is excluded from repair-json failures", async () => {
    writeRule(
      "evidence.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: evidence
    reason: "legacy"
    owner: "@alice"
    expires: "2099-01-01"
`,
    )
    const { code, out } = await runAndCapture({ format: "repair-json" })
    expect(code).toBe(0)
    const parsed = JSON.parse(out)
    expect(parsed.failures).toHaveLength(0)
    expect(parsed.waived).toHaveLength(1)
    expect(parsed.waived[0].waiverReason).toBe("legacy")
  })

  it("waived violation appears as SARIF suppression", async () => {
    writeRule(
      "evidence.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: evidence
    reason: "legacy waiver"
    owner: "@alice"
    expires: "2099-01-01"
`,
    )
    const { code, out } = await runAndCapture({ format: "sarif" })
    expect(code).toBe(0)
    const parsed = JSON.parse(out)
    const result = parsed.runs[0].results[0]
    expect(result.suppressions).toBeDefined()
    expect(result.suppressions[0].justification).toBe("legacy waiver")
    expect(result.level).toBe("note")
  })

  it("pretty format separates waived block from blockers", async () => {
    writeRule(
      "evidence.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: evidence
    reason: "legacy waiver"
    owner: "@alice"
    expires: "2099-01-01"
`,
    )
    const { code, out } = await runAndCapture({ format: "pretty" })
    expect(code).toBe(0)
    expect(out).toContain("waived (advisory):")
    expect(out).toContain("PASSED_WITH_WARNINGS")
  })

  it("invalid waivers.yaml fails closed with exit 2 in pretty mode", async () => {
    writeRule(
      "evidence.md",
      `---
title: Has README
checks:
  - type: file-exists
    path: README.md
---
`,
    )
    writeFileSync(join(tmpDir, "README.md"), "x")
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: ""
    reason: "x"
`,
    )
    const { code } = await runAndCapture({ format: "pretty" })
    expect(code).toBe(2)
  })

  it("pr-markdown format produces sectioned report", async () => {
    writeRule(
      "evidence.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    const { code, out } = await runAndCapture({ format: "pr-markdown" })
    expect(code).toBe(1)
    expect(out).toContain("## rulebound check — **FAILED**")
    expect(out).toContain("### Deterministic blockers")
    expect(out).toContain("### Deterministic warnings")
    expect(out).toContain("### Waivers applied")
    expect(out).toContain("### Analyzer findings")
    expect(out).toContain("### Repair")
    expect(out).toContain("rulebound check")
  })

  it("pr-markdown lists waived findings in waivers table", async () => {
    writeRule(
      "evidence.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: evidence
    reason: "legacy"
    owner: "@alice"
    expires: "2099-01-01"
`,
    )
    const { code, out } = await runAndCapture({ format: "pr-markdown" })
    expect(code).toBe(0)
    expect(out).toContain("@alice")
    expect(out).toContain("2099-01-01")
    expect(out).toContain("PASSED_WITH_WARNINGS")
  })

  it("invalid waivers.yaml emits structured error in json mode and exits 2", async () => {
    writeRule(
      "evidence.md",
      `---
title: Has README
checks:
  - type: file-exists
    path: README.md
---
`,
    )
    writeFileSync(join(tmpDir, "README.md"), "x")
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: r1
    reason: "x"
    expires: "tomorrow"
`,
    )
    const errs: string[] = []
    const origErr = console.error
    ;(console as Console).error = (msg: unknown) => {
      errs.push(String(msg))
    }
    let code = -1
    try {
      const r = await runAndCapture({ format: "json" })
      code = r.code
    } finally {
      ;(console as Console).error = origErr
    }
    const joined = errs.join("\n")
    expect(joined).toContain("waiver-load-errors")
    expect(code).toBe(2)
  })

  describe("waiver fail-closed across all formats", () => {
    const formats: ("pretty" | "json" | "github" | "sarif" | "repair-json" | "pr-markdown")[] = [
      "pretty",
      "json",
      "github",
      "sarif",
      "repair-json",
      "pr-markdown",
    ]

    for (const format of formats) {
      it(`exits 2 on invalid waivers with --format ${format} even when checks pass`, async () => {
        writeRule(
          "evidence.md",
          `---
title: Has README
checks:
  - type: file-exists
    path: README.md
---
`,
        )
        writeFileSync(join(tmpDir, "README.md"), "x")
        writeFileSync(
          join(tmpDir, ".rulebound", "waivers.yaml"),
          `waivers:
  - rule: r1
    reason: "x"
`,
        )
        const { code } = await runAndCapture({ format })
        expect(code).toBe(2)
      })
    }
  })
})
