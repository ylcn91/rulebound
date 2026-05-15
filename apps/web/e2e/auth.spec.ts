import { expect, test } from "@playwright/test"

// Passcode login + redirect to /dashboard. The fixture stack sets
// RULEBOUND_DASHBOARD_PASSCODE=e2e-passcode (see start-stack.mjs).

const PASSCODE = process.env.E2E_DASHBOARD_PASSCODE ?? "e2e-passcode"

test.describe("dashboard auth", () => {
  test("guards /dashboard with the passcode and redirects after login", async ({
    page,
    context,
  }) => {
    await context.clearCookies()

    // Unauthenticated visit redirects to /access
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/access(\?.*)?$/)

    // Enter passcode
    await page.locator('input[name="passcode"]').fill(PASSCODE)
    await page.getByRole("button", { name: /unlock dashboard/i }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible()
  })

  test("rejects a wrong passcode with an inline error", async ({ page, context }) => {
    await context.clearCookies()

    await page.goto("/access")
    await page.locator('input[name="passcode"]').fill("definitely-wrong")
    await page.getByRole("button", { name: /unlock dashboard/i }).click()

    await expect(page).toHaveURL(/\/access\?error=invalid/)
    await expect(page.getByText(/invalid/i)).toBeVisible()
  })
})
