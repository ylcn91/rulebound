import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { evidenceCommand } from "../commands/evidence.js"
import { adviseCommand } from "../commands/advise.js"

describe("evidence command", () => {
  let tmpDir: string
  let originalCwd: string
  let exitSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalCwd = process.cwd()
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-evidence-"))
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

  async function run<T>(fn: () => Promise<T>): Promise<{ code: number; out: string }> {
    let code = -1
    try {
      await fn()
    } catch (e) {
      const m = (e instanceof Error ? e.message : String(e)).match(/__EXIT__:(\d+)/)
      if (m) code = Number(m[1])
      else throw e
    }
    const out = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n")
    return { code, out }
  }

  it("defaults to pr-markdown output", async () => {
    writeFileSync(join(tmpDir, "README.md"), "x")
    writeFileSync(
      join(tmpDir, ".rulebound/rules/evidence.md"),
      `---
title: Has README
checks:
  - type: file-exists
    path: README.md
---
`,
    )
    const { code, out } = await run(() => evidenceCommand({}))
    expect(code).toBe(0)
    expect(out).toContain("## rulebound check —")
    expect(out).toContain("### Deterministic blockers")
  })
})

describe("advise command", () => {
  let originalCwd: string
  let exitSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>
  let tmpDir: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-advise-"))
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

  async function run<T>(fn: () => Promise<T>): Promise<{ code: number }> {
    let code = -1
    try {
      await fn()
    } catch (e) {
      const m = (e instanceof Error ? e.message : String(e)).match(/__EXIT__:(\d+)/)
      if (m) code = Number(m[1])
      else throw e
    }
    return { code }
  }

  it("rejects empty invocation with exit 2", async () => {
    const { code } = await run(() => adviseCommand({}))
    expect(code).toBe(2)
  })

  it("rejects both plan and diff with exit 2", async () => {
    const { code } = await run(() => adviseCommand({ plan: "x", diff: true }))
    expect(code).toBe(2)
  })

  it("prints advisory warning header", async () => {
    await run(() => adviseCommand({}))
    const allErr = errSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n")
    expect(allErr).toContain("Advisory matching only")
    expect(allErr).toContain("NOT the deterministic gate")
  })
})
