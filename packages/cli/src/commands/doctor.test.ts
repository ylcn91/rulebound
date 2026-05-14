import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { doctorCommand } from "./doctor.js"

describe("doctor", () => {
  let tmpDir: string
  let originalCwd: string
  let exitSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalCwd = process.cwd()
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-doctor-"))
    process.chdir(tmpDir)
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__EXIT__:${code ?? 0}`)
    }) as never)
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tmpDir, { recursive: true, force: true })
    exitSpy.mockRestore()
    logSpy.mockRestore()
  })

  async function run(): Promise<{ code: number; out: string }> {
    let code = -1
    try {
      await doctorCommand()
    } catch (e) {
      const m = (e instanceof Error ? e.message : String(e)).match(/__EXIT__:(\d+)/)
      if (m) code = Number(m[1])
      else throw e
    }
    const out = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n")
    return { code, out }
  }

  it("reports analyzer expectations when rules ask for them", async () => {
    mkdirSync(join(tmpDir, ".rulebound/rules"), { recursive: true })
    writeFileSync(
      join(tmpDir, ".rulebound/rules/eslint.md"),
      `---
title: ESLint
checks:
  - type: analyzer
    analyzer: eslint
    report: "eslint-report.json"
    report_format: json
---
`,
    )
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain("analyzer:eslint")
    expect(out).toContain("report file(s) not found yet")
  })

  it("flags command-checks that need --allow-commands", async () => {
    mkdirSync(join(tmpDir, ".rulebound/rules"), { recursive: true })
    writeFileSync(
      join(tmpDir, ".rulebound/rules/tsc.md"),
      `---
title: TSC check
checks:
  - type: command
    run: "tsc --noEmit"
---
`,
    )
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain("command checks")
    expect(out).toContain("--allow-commands")
  })

  it("clean output when no analyzer / command rules", async () => {
    mkdirSync(join(tmpDir, ".rulebound/rules"), { recursive: true })
    writeFileSync(
      join(tmpDir, ".rulebound/rules/regex.md"),
      `---
title: regex only
checks:
  - type: regex
    pattern: "TODO"
---
`,
    )
    const { code, out } = await run()
    expect(code).toBe(0)
    expect(out).toContain("no `type: analyzer` checks configured")
    expect(out).not.toContain("command checks")
  })

  it("exits 2 when rules dir is missing", async () => {
    const { code } = await run()
    expect(code).toBe(2)
  })
})
