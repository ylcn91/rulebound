import { describe, expect, it } from "vitest"
import {
  createBugfixSpec,
  parseBugfixSpecMarkdown,
  renderBugfixPlanTemplate,
  renderBugfixSpecMarkdown,
  slugifyBugfixTitle,
  validateBugfixPlan,
  validateBugfixSpec,
} from "../bugfix.js"

describe("bugfix boundary helpers", () => {
  it("creates and round-trips a bugfix spec markdown artifact", () => {
    const spec = createBugfixSpec({
      title: "Delete user without billing profile",
      summary: "Deleting a user crashes when the billing profile is null.",
      condition: "Delete a user whose billing profile is null.",
      postcondition: "Deletion succeeds and the user record is removed.",
      preservationScenarios: [
        "Deleting a user with a billing profile still succeeds.",
      ],
      rootCauseHypothesis: "The delete path dereferences billing profile fields without a null guard.",
      filesInScope: ["packages/server/src/api/users.ts"],
      filesOutOfScope: ["packages/server/src/api/billing.ts"],
    })

    const markdown = renderBugfixSpecMarkdown(spec)
    const parsed = parseBugfixSpecMarkdown(markdown)

    expect(parsed).toMatchObject({
      title: "Delete user without billing profile",
      slug: "delete-user-without-billing-profile",
      condition: { description: "Delete a user whose billing profile is null." },
      postcondition: { description: "Deletion succeeds and the user record is removed." },
      preservationScenarios: [
        { description: "Deleting a user with a billing profile still succeeds." },
      ],
      filesInScope: ["packages/server/src/api/users.ts"],
      filesOutOfScope: ["packages/server/src/api/billing.ts"],
    })
  })

  it("validates missing bugfix spec sections conservatively", () => {
    const spec = createBugfixSpec({
      title: "",
      summary: "",
      condition: "",
      postcondition: "",
      preservationScenarios: [],
      rootCauseHypothesis: "",
      fixTests: [],
      preservationTests: [],
    })

    const validation = validateBugfixSpec(spec)

    expect(validation.ok).toBe(false)
    expect(validation.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        "title",
        "summary",
        "condition",
        "postcondition",
        "rootCauseHypothesis",
        "filesInScope",
        "filesOutOfScope",
      ]),
    )
  })

  it("falls back to default preservation and test scaffolding when optional lists are omitted or empty", () => {
    const spec = createBugfixSpec({
      summary: "Deleting a user crashes when the billing profile is null.",
      preservationScenarios: [],
      fixTests: [],
      preservationTests: [],
    })

    expect(spec.preservationScenarios).toEqual([
      { description: "Behavior outside the bug condition remains unchanged." },
    ])
    expect(spec.fixTests).toHaveLength(1)
    expect(spec.preservationTests).toEqual([
      'Add a preservation test proving "Behavior outside the bug condition remains unchanged." remains unchanged.',
    ])
  })

  it("validates bugfix plans against preservation scenarios and guardrails", () => {
    const spec = createBugfixSpec({
      title: "Delete user without billing profile",
      summary: "Deleting a user crashes when the billing profile is null.",
      condition: "Delete a user whose billing profile is null.",
      postcondition: "Deletion succeeds and the user record is removed.",
      preservationScenarios: [
        "Deleting a user with a billing profile still succeeds.",
      ],
      rootCauseHypothesis: "The delete path dereferences billing profile fields without a null guard.",
      filesInScope: ["packages/server/src/api/users.ts"],
      filesOutOfScope: ["packages/server/src/api/billing.ts"],
    })

    const validPlan = renderBugfixPlanTemplate(spec)
    expect(validateBugfixPlan(spec, validPlan)).toEqual({ ok: true, issues: [] })

    const invalidPlan = `## Root Cause Hypothesis
The null billing profile path dereferences a missing object.

## Change Strategy
Patch the delete handler.

## Fix Validation
- Add a test proving deletion succeeds for a null billing profile.

## Preservation Checks
- Keep unrelated behavior healthy.
`

    const invalidValidation = validateBugfixPlan(spec, invalidPlan)
    expect(invalidValidation.ok).toBe(false)
    expect(invalidValidation.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining([
        "plan.preservationChecks",
        "plan.scopeGuardrails",
      ]),
    )
  })

  it("slugifies bugfix titles safely", () => {
    expect(slugifyBugfixTitle(" Delete user / billing profile ")).toBe("delete-user-billing-profile")
  })
})
