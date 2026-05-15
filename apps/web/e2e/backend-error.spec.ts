import { expect, test } from "@playwright/test"
import { login } from "./_helpers"

// Verifies the BackendErrorState path renders when the dashboard cannot
// reach the API. We force this by routing the network call to /v1/rules
// to a hard failure via Playwright's request interception.

test.describe("backend error state", () => {
  test("shows BackendErrorState on the dashboard when the API is unreachable", async ({
    page,
  }) => {
    await login(page)

    await page.route(/\/v1\/.*/, (route) => route.abort("failed"))
    await page.goto("/dashboard")

    // BackendErrorState renders an AlertTriangle + a dashed-border card.
    // The component exposes a "Backend unavailable"-style title that the
    // dashboard page passes in (see dashboard/page.tsx).
    await expect(page.getByText(/backend|unreachable|unavailable/i).first()).toBeVisible()
  })
})
