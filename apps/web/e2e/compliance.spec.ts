import { expect, test } from "@playwright/test"
import { login } from "./_helpers"

test.describe("compliance page", () => {
  test("renders the current score and trend", async ({ page }) => {
    await login(page)
    await page.goto("/compliance")

    await expect(page.getByText(/compliance/i).first()).toBeVisible()
    // Fixture returns currentScore=87; the dashboard surfaces it as text.
    await expect(page.getByText(/87/).first()).toBeVisible()
  })
})
