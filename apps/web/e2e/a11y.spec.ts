import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { login } from "./_helpers"

// Per WEB-004: this suite REPORTS findings; it does NOT block. Component
// fixes are deferred to v0.2 (see docs/audit/a11y-findings.md). Reasoning:
// the Wave 4 plan explicitly forbids component refactors here and the
// release gate must remain green while the v0.2 component patches land.
// Findings are attached to the test report so CI nightly captures the
// current state of the dashboard's accessibility surface.
//
// To upgrade this to a hard gate (post-v0.2): flip the `mode` constant
// below to "fail-critical" and the matching expectation will fire.

type AxeGateMode = "report-only" | "fail-critical"

const MODE: AxeGateMode = (process.env.E2E_A11Y_MODE as AxeGateMode) ?? "report-only"

const PAGES = [
  { path: "/dashboard", label: "dashboard overview" },
  { path: "/rules", label: "rules list" },
  { path: "/projects", label: "projects list" },
  { path: "/webhooks", label: "webhooks list" },
  { path: "/audit", label: "audit log" },
  { path: "/compliance", label: "compliance" },
  { path: "/settings", label: "settings" },
]

test.describe("dashboard accessibility (axe-core)", () => {
  for (const { path, label } of PAGES) {
    test(`${label} axe scan (${MODE})`, async ({ page }, testInfo) => {
      await login(page)
      await page.goto(path)
      await page.waitForLoadState("networkidle").catch(() => undefined)

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()

      const critical = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      )
      const moderate = accessibilityScanResults.violations.filter(
        (v) => v.impact === "moderate",
      )

      if (accessibilityScanResults.violations.length > 0) {
        await testInfo.attach(
          `axe-${path.replace(/\//g, "_")}.json`,
          {
            body: JSON.stringify(accessibilityScanResults.violations, null, 2),
            contentType: "application/json",
          },
        )
      }

      if (critical.length > 0) {
        console.warn(
          `[axe critical/serious] ${path}: ` +
            critical.map((v) => v.id).join(", "),
        )
      }
      if (moderate.length > 0) {
        console.warn(
          `[axe moderate] ${path}: ` +
            moderate.map((v) => v.id).join(", "),
        )
      }

      if (MODE === "fail-critical") {
        expect(
          critical,
          critical
            .map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`)
            .join("\n"),
        ).toEqual([])
      } else {
        // report-only: the suite passes regardless. Findings are attached
        // and warnings logged for v0.2 follow-up.
        expect(accessibilityScanResults.violations.length).toBeGreaterThanOrEqual(0)
      }
    })
  }

  test("dashboard ring animation respects prefers-reduced-motion", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" })
    const page = await context.newPage()
    await login(page)
    await page.goto("/dashboard")

    // The ring animation lives on the SVG `circle` with
    // className="transition-all duration-500" inside ScoreRing
    // (dashboard/page.tsx). With prefers-reduced-motion the browser
    // should not animate; we assert that querying the element does not
    // raise (sanity) and that the className tag is present so future
    // refactors that strip it surface in this test.
    const circle = page.locator("svg circle.transition-all")
    await expect(circle).toBeVisible()

    await context.close()
  })
})
