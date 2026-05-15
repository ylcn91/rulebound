import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { checkCommand, type CheckOptions } from "../commands/check.js"

/**
 * CLI-002 — exit-code contract for `rulebound check`.
 *
 * Documented contract (must stay in lockstep with docs/release-gate.md and
 * docs/quickstart.md):
 *
 *   exit 0 — all deterministic checks PASSED (or PASSED_WITH_WARNINGS while
 *            no --fail-on-advisory flag is set)
 *   exit 1 — at least one deterministic blocker (status FAILED)
 *   exit 2 — config / runtime / schema error (no rules, invalid waivers)
 *   exit 3 — advisory failure when --fail-on-advisory is set
 *
 * Machine-format flags (json, sarif, github, repair-json, pr-markdown) emit
 * their payload to stdout; structured errors (e.g. invalid waivers) emit a
 * single-line JSON envelope to stderr in machine modes.
 */

interface RunOutcome {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

describe("CLI exit-code matrix", () => {
  let tmpDir: string
  let originalCwd: string
  let exitSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalCwd = process.cwd()
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-exit-codes-"))
    mkdirSync(join(tmpDir, ".rulebound", "rules"), { recursive: true })
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
    writeFileSync(join(tmpDir, ".rulebound", "rules", file), body)
  }

  async function run(opts: CheckOptions): Promise<RunOutcome> {
    let code = -1
    try {
      await checkCommand(opts)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const m = msg.match(/__EXIT__:(\d+)/)
      if (m) code = Number(m[1])
      else throw e
    }
    const stdout = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n")
    const stderr = errSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n")
    return { code, stdout, stderr }
  }

  const PASS_RULE = `---
title: Pass Rule
checks:
  - type: file-exists
    path: README.md
---
`

  const BLOCKING_RULE = `---
title: Blocking Rule
checks:
  - type: file-exists
    path: missing.md
    severity: error
---
`

  const ADVISORY_RULE = `---
title: Advisory Rule
checks:
  - type: file-exists
    path: missing.md
    severity: warning
---
`

  // Exit code 0 — all pass.
  describe("exit 0 — all checks PASS", () => {
    const formats: NonNullable<CheckOptions["format"]>[] = [
      "pretty",
      "json",
      "github",
      "repair-json",
      "sarif",
      "pr-markdown",
    ]
    for (const format of formats) {
      it(`format=${format} → exit 0 when nothing is wrong`, async () => {
        writeFileSync(join(tmpDir, "README.md"), "hi\n")
        writeRule("pass.md", PASS_RULE)
        const r = await run({ format })
        expect(r.code).toBe(0)
      })
    }
  })

  // Exit code 1 — deterministic blocker.
  describe("exit 1 — deterministic blocker", () => {
    it("json: status=FAILED on stdout, exit 1", async () => {
      writeRule("blocker.md", BLOCKING_RULE)
      const r = await run({ format: "json" })
      expect(r.code).toBe(1)
      const parsed = JSON.parse(r.stdout)
      expect(parsed.status).toBe("FAILED")
      expect(parsed.summary.blocking).toBeGreaterThanOrEqual(1)
    })

    it("github: ::error::-style annotation on stdout, exit 1", async () => {
      writeRule("blocker.md", BLOCKING_RULE)
      const r = await run({ format: "github" })
      expect(r.code).toBe(1)
      expect(r.stdout).toContain("::error")
      expect(r.stdout).toContain("blocker") // rule id derives from filename
    })

    it("repair-json: failures array non-empty, exit 1", async () => {
      writeRule("blocker.md", BLOCKING_RULE)
      const r = await run({ format: "repair-json" })
      expect(r.code).toBe(1)
      const parsed = JSON.parse(r.stdout)
      expect(parsed.failures.length).toBeGreaterThanOrEqual(1)
      expect(parsed.status).toBe("FAILED")
    })

    it("sarif: results[0].level=error, exit 1", async () => {
      writeRule("blocker.md", BLOCKING_RULE)
      const r = await run({ format: "sarif" })
      expect(r.code).toBe(1)
      const parsed = JSON.parse(r.stdout)
      expect(parsed.runs[0].results[0].level).toBe("error")
    })

    it("pr-markdown: FAILED badge in stdout, exit 1", async () => {
      writeRule("blocker.md", BLOCKING_RULE)
      const r = await run({ format: "pr-markdown" })
      expect(r.code).toBe(1)
      expect(r.stdout).toContain("**FAILED**")
    })
  })

  // Exit code 2 — config / runtime / schema error.
  describe("exit 2 — config/runtime/schema error", () => {
    it("no rules directory → exit 2 on stderr", async () => {
      // No rules written at all + rules dir removed
      rmSync(join(tmpDir, ".rulebound"), { recursive: true, force: true })
      const r = await run({ format: "json" })
      expect(r.code).toBe(2)
      expect(r.stderr).toMatch(/No rules found/i)
    })

    it("invalid waivers.yaml → exit 2 with structured stderr in json mode", async () => {
      writeFileSync(join(tmpDir, "README.md"), "x")
      writeRule("pass.md", PASS_RULE)
      writeFileSync(
        join(tmpDir, ".rulebound", "waivers.yaml"),
        `waivers:
  - rule: r1
    reason: "x"
    expires: "not-a-date"
`,
      )
      const r = await run({ format: "json" })
      expect(r.code).toBe(2)
      expect(r.stderr).toContain("waiver-load-errors")
      // Single-line JSON envelope.
      const firstStderrLine = r.stderr.split("\n").find((l: string) => l.includes("waiver-load-errors")) ?? ""
      const parsed = JSON.parse(firstStderrLine)
      expect(parsed.kind).toBe("waiver-load-errors")
      expect(Array.isArray(parsed.errors)).toBe(true)
    })

    it("invalid waivers.yaml in pretty mode → exit 2 with human-readable stderr", async () => {
      writeFileSync(join(tmpDir, "README.md"), "x")
      writeRule("pass.md", PASS_RULE)
      writeFileSync(
        join(tmpDir, ".rulebound", "waivers.yaml"),
        `waivers:
  - rule: ""
    reason: "missing rule id"
`,
      )
      const r = await run({ format: "pretty" })
      expect(r.code).toBe(2)
      expect(r.stderr).toMatch(/waiver load errors/i)
    })
  })

  // Exit code 3 — advisory + --fail-on-advisory.
  describe("exit 3 — advisory failure with --fail-on-advisory", () => {
    it("warning-only finding + --fail-on-advisory → exit 3", async () => {
      writeRule("advisory.md", ADVISORY_RULE)
      const r = await run({ format: "json", failOnAdvisory: true })
      expect(r.code).toBe(3)
      const parsed = JSON.parse(r.stdout)
      // Report status is PASSED_WITH_WARNINGS, not FAILED — the gate is in the CLI.
      expect(parsed.status).toBe("PASSED_WITH_WARNINGS")
      expect(parsed.summary.violated).toBeGreaterThanOrEqual(1)
      expect(parsed.summary.blocking).toBe(0)
    })

    it("warning-only finding without --fail-on-advisory → exit 0", async () => {
      writeRule("advisory.md", ADVISORY_RULE)
      const r = await run({ format: "json" })
      expect(r.code).toBe(0)
      const parsed = JSON.parse(r.stdout)
      expect(parsed.status).toBe("PASSED_WITH_WARNINGS")
    })

    it("FAILED status takes precedence over --fail-on-advisory (still exit 1)", async () => {
      // A blocker AND an advisory together — exit 1 wins because the CLI
      // checks `status === FAILED` before the advisory gate.
      writeRule("blocker.md", BLOCKING_RULE)
      writeRule("advisory.md", ADVISORY_RULE)
      const r = await run({ format: "json", failOnAdvisory: true })
      expect(r.code).toBe(1)
      const parsed = JSON.parse(r.stdout)
      expect(parsed.status).toBe("FAILED")
    })
  })

  // Machine-format stream separation.
  describe("machine-format stdout/stderr separation", () => {
    it("json mode: ONLY payload on stdout, NO log noise on stdout", async () => {
      writeFileSync(join(tmpDir, "README.md"), "x")
      writeRule("pass.md", PASS_RULE)
      const r = await run({ format: "json" })
      expect(r.code).toBe(0)
      // stdout must be a single parseable JSON document.
      expect(() => JSON.parse(r.stdout)).not.toThrow()
    })

    it("repair-json mode: ONLY payload on stdout", async () => {
      writeFileSync(join(tmpDir, "README.md"), "x")
      writeRule("pass.md", PASS_RULE)
      const r = await run({ format: "repair-json" })
      expect(r.code).toBe(0)
      expect(() => JSON.parse(r.stdout)).not.toThrow()
    })

    it("sarif mode: ONLY SARIF payload on stdout", async () => {
      writeFileSync(join(tmpDir, "README.md"), "x")
      writeRule("pass.md", PASS_RULE)
      const r = await run({ format: "sarif" })
      expect(r.code).toBe(0)
      const parsed = JSON.parse(r.stdout)
      expect(parsed.version).toBe("2.1.0")
    })

    it("waiver-load-errors envelope goes to stderr, NOT stdout", async () => {
      writeFileSync(join(tmpDir, "README.md"), "x")
      writeRule("pass.md", PASS_RULE)
      writeFileSync(
        join(tmpDir, ".rulebound", "waivers.yaml"),
        `waivers:
  - rule: r1
    reason: "x"
`,
      )
      const r = await run({ format: "json" })
      expect(r.code).toBe(2)
      expect(r.stderr).toContain("waiver-load-errors")
      // stdout must NOT contain the report (CLI bails out before printing it).
      expect(r.stdout).toBe("")
    })
  })
})
