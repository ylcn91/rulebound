import { expect, test } from "@playwright/test"
import { login } from "./_helpers"

test.describe("projects page", () => {
  test("renders the seeded project list", async ({ page }) => {
    await login(page)
    await page.goto("/projects")

    await expect(page.getByText("rulebound-web").first()).toBeVisible()
  })

  test("preview banner stays visible across navigation", async ({ page }) => {
    await login(page)
    await page.goto("/projects")
    await expect(page.getByRole("status", { name: /self-hosted preview/i })).toBeVisible()

    await page.goto("/audit")
    await expect(page.getByRole("status", { name: /self-hosted preview/i })).toBeVisible()
  })
})
