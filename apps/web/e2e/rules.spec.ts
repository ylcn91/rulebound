import { expect, test } from "@playwright/test"
import { login } from "./_helpers"

test.describe("rules page", () => {
  test("lists seeded rules and exposes the preview banner", async ({ page }) => {
    await login(page)
    await page.goto("/rules")

    // PreviewBanner is mounted in the dashboard layout
    await expect(page.getByRole("status", { name: /self-hosted preview/i })).toBeVisible()

    // Seeded rule from the fixture backend
    await expect(page.getByText("Prefer server components")).toBeVisible()
  })

  test("opens the rule detail surface from the list", async ({ page }) => {
    await login(page)
    await page.goto("/rules")

    await page.getByRole("link", { name: /prefer server components/i }).click()
    await expect(page).toHaveURL(/\/rules\/rule-001$/)
    await expect(page.getByText(/server components/i)).toBeVisible()
  })
})
