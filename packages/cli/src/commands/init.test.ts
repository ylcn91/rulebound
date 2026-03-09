import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initCommand } from "./init.js"
import { PRE_COMMIT_HOOK_CONTENT } from "../lib/pre-commit-hook.js"

describe("initCommand", () => {
  const originalCwd = process.cwd()
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rulebound-init-"))
    mkdirSync(join(tempDir, ".git"), { recursive: true })
    process.chdir(tempDir)
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.chdir(originalCwd)
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("auto-installs the same staged-only hook during init", async () => {
    await initCommand({})

    const hookPath = join(tempDir, ".git", "hooks", "pre-commit")
    expect(readFileSync(hookPath, "utf-8")).toBe(PRE_COMMIT_HOOK_CONTENT)
    expect(existsSync(join(tempDir, ".rulebound", "rules", "global", "example-rule.md"))).toBe(true)
  })
})
