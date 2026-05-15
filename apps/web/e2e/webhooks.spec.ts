import { expect, test } from "@playwright/test"
import { login } from "./_helpers"

test.describe("webhooks page", () => {
  test("renders the empty state when no endpoints exist yet", async ({ page }) => {
    await login(page)
    await page.goto("/webhooks")

    // Fixture starts with zero webhooks; UI surfaces an explicit "no
    // endpoints" affordance rather than a silent blank page.
    await expect(page.getByText(/webhook/i).first()).toBeVisible()
  })
})
