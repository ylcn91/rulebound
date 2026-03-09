import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { startBugfixWorkflow, validateBugfixPlanRequest } from "../bugfix.js"

describe("bugfix MCP helpers", () => {
  let originalCwd: string
  let tempDir: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = mkdtempSync(join(tmpdir(), "rulebound-mcp-bugfix-"))
    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("starts a bugfix workflow and stores the spec artifact", () => {
    const result = startBugfixWorkflow({
      summary: "Deleting a user crashes when the billing profile is null.",
      title: "Delete user without billing profile",
      condition: "Delete a user whose billing profile is null.",
      postcondition: "Deletion succeeds and the user record is removed.",
      preservationScenarios: [
        "Deleting a user with a billing profile still succeeds.",
      ],
      rootCauseHypothesis: "The delete handler dereferences billing profile fields without a null guard.",
      filesInScope: ["packages/server/src/api/users.ts"],
      filesOutOfScope: ["packages/server/src/api/billing.ts"],
    })

    expect(result.approved).toBe(true)
    expect(result.path).toContain("/.rulebound/bugfixes/delete-user-without-billing-profile.md")
    expect(readFileSync(result.path!, "utf-8")).toContain("## Preservation Scenarios")
    expect(result.planTemplate).toContain("## Scope Guardrails")
  })

  it("rejects bugfix plans that do not cover preservation scenarios", () => {
    const started = startBugfixWorkflow({
      summary: "Deleting a user crashes when the billing profile is null.",
      title: "Delete user without billing profile",
      condition: "Delete a user whose billing profile is null.",
      postcondition: "Deletion succeeds and the user record is removed.",
      preservationScenarios: [
        "Deleting a user with a billing profile still succeeds.",
      ],
      rootCauseHypothesis: "The delete handler dereferences billing profile fields without a null guard.",
      filesInScope: ["packages/server/src/api/users.ts"],
      filesOutOfScope: ["packages/server/src/api/billing.ts"],
    })

    const result = validateBugfixPlanRequest({
      specPath: started.path!,
      plan: `## Root Cause Hypothesis
The delete handler dereferences a null billing profile.

## Change Strategy
Patch the delete handler only.

## Fix Validation
- Add a test for deleting a user whose billing profile is null and assert deletion succeeds.

## Preservation Checks
- Keep behavior stable.
`,
    })

    expect(result.approved).toBe(false)
    expect(result.planValidation.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        "plan.preservationChecks",
        "plan.scopeGuardrails",
      ]),
    )
  })
})
