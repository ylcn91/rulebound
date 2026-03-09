import { mkdtempSync, readFileSync, rmSync, statSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { hookCommand } from "./hook.js"
import { PRE_COMMIT_HOOK_CONTENT } from "../lib/pre-commit-hook.js"

describe("hookCommand", () => {
  const originalCwd = process.cwd()
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rulebound-hook-"))
    mkdirSync(join(tempDir, ".git", "hooks"), { recursive: true })
    process.chdir(tempDir)
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.chdir(originalCwd)
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("installs a staged-only pre-commit hook", async () => {
    await hookCommand({})

    const hookPath = join(tempDir, ".git", "hooks", "pre-commit")
    expect(readFileSync(hookPath, "utf-8")).toBe(PRE_COMMIT_HOOK_CONTENT)
    expect(statSync(hookPath).mode & 0o777).toBe(0o755)
  })
})
