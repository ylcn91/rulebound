import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parseBugfixSpecMarkdown, renderBugfixPlanTemplate } from "@rulebound/engine"
import { bugfixCommand, validateBugfixCommand } from "./bugfix.js"

describe("bugfixCommand", () => {
  let originalCwd: string
  let tempDir: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = mkdtempSync(join(tmpdir(), "rulebound-cli-bugfix-"))
    process.chdir(tempDir)
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.chdir(originalCwd)
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("writes a bugfix spec under .rulebound/bugfixes", async () => {
    await bugfixCommand({
      summary: "Deleting a user crashes when the billing profile is null.",
      title: "Delete user without billing profile",
      condition: "Delete a user whose billing profile is null.",
      postcondition: "Deletion succeeds and the user record is removed.",
      preserve: "Deleting a user with a billing profile still succeeds.",
      rootCause: "The delete handler dereferences billing profile fields without a null guard.",
      scope: "packages/server/src/api/users.ts",
      outOfScope: "packages/server/src/api/billing.ts",
    })

    const filePath = join(tempDir, ".rulebound", "bugfixes", "delete-user-without-billing-profile.md")
    const markdown = readFileSync(filePath, "utf-8")

    expect(markdown).toContain("# Bugfix Boundary: Delete user without billing profile")
    expect(markdown).toContain("## Bug Condition (C)")
    expect(markdown).toContain("## Preservation Tests")
  })

  it("validates a generated bugfix spec plus plan template", async () => {
    await bugfixCommand({
      summary: "Deleting a user crashes when the billing profile is null.",
      title: "Delete user without billing profile",
      condition: "Delete a user whose billing profile is null.",
      postcondition: "Deletion succeeds and the user record is removed.",
      preserve: "Deleting a user with a billing profile still succeeds.",
      rootCause: "The delete handler dereferences billing profile fields without a null guard.",
      scope: "packages/server/src/api/users.ts",
      outOfScope: "packages/server/src/api/billing.ts",
    })

    const filePath = join(tempDir, ".rulebound", "bugfixes", "delete-user-without-billing-profile.md")
    const plan = renderBugfixPlanTemplate(parseBugfixSpecMarkdown(readFileSync(filePath, "utf-8")))

    await expect(validateBugfixCommand({ file: filePath, plan })).resolves.toBeUndefined()
  })

  it("fails validation when the bugfix plan misses preservation guardrails", async () => {
    await bugfixCommand({
      summary: "Deleting a user crashes when the billing profile is null.",
      title: "Delete user without billing profile",
      condition: "Delete a user whose billing profile is null.",
      postcondition: "Deletion succeeds and the user record is removed.",
      preserve: "Deleting a user with a billing profile still succeeds.",
      rootCause: "The delete handler dereferences billing profile fields without a null guard.",
      scope: "packages/server/src/api/users.ts",
      outOfScope: "packages/server/src/api/billing.ts",
    })

    const filePath = join(tempDir, ".rulebound", "bugfixes", "delete-user-without-billing-profile.md")
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`)
    }) as typeof process.exit)

    const badPlan = `## Root Cause Hypothesis
The delete handler dereferences a null billing profile.

## Change Strategy
Patch the delete handler.

## Fix Validation
- Add a test for deleting a user whose billing profile is null.

## Preservation Checks
- Keep unrelated behavior healthy.
`

    await expect(validateBugfixCommand({ file: filePath, plan: badPlan })).rejects.toThrow("process.exit:1")
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
