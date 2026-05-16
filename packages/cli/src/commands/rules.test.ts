import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { newRuleCommand } from "./rules.js"

describe("rules new", () => {
  const originalCwd = process.cwd()
  let tmpDir: string
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-rules-new-"))
    process.chdir(tmpDir)
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__EXIT__:${code ?? 0}`)
    }) as never)
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.chdir(originalCwd)
    rmSync(tmpDir, { recursive: true, force: true })
  })

  async function runNew(type: string, name: string): Promise<number> {
    try {
      await newRuleCommand(type, name, { category: "testing" })
      return 0
    } catch (error) {
      const match = (error instanceof Error ? error.message : String(error)).match(/__EXIT__:(\d+)/)
      if (match) return Number(match[1])
      throw error
    }
  }

  it("creates a non-overwriting regex rule template", async () => {
    await newRuleCommand("regex", "No Console Log", { category: "style" })

    const filePath = join(tmpDir, ".rulebound", "rules", "style", "no-console-log.md")
    expect(existsSync(filePath)).toBe(true)

    const content = readFileSync(filePath, "utf-8")
    expect(content).toContain("type: regex")
    expect(content).toContain("id: no-console-log")
    expect(content).toContain("forbidden: true")
  })

  it("creates a diff-evidence rule template", async () => {
    await newRuleCommand("diff-evidence", "Source Needs Test", { category: "testing" })

    const filePath = join(tmpDir, ".rulebound", "rules", "testing", "source-needs-test.md")
    expect(existsSync(filePath)).toBe(true)

    const content = readFileSync(filePath, "utf-8")
    expect(content).toContain("type: diff-evidence")
    expect(content).toContain("when_changed:")
    expect(content).toContain("require_changed:")
  })

  it("refuses to overwrite an existing template path", async () => {
    const filePath = join(tmpDir, ".rulebound", "rules", "testing", "no-console-log.md")
    mkdirSync(join(tmpDir, ".rulebound", "rules", "testing"), { recursive: true })
    writeFileSync(filePath, "existing")

    const code = await runNew("regex", "No Console Log")

    expect(code).toBe(2)
    expect(readFileSync(filePath, "utf-8")).toBe("existing")
    expect(exitSpy).toHaveBeenCalledWith(2)
  })
})
