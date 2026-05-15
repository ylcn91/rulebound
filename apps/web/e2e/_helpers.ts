import type { Page } from "@playwright/test"

const PASSCODE = process.env.E2E_DASHBOARD_PASSCODE ?? "e2e-passcode"

export async function login(page: Page): Promise<void> {
  await page.goto("/access")
  await page.locator('input[name="passcode"]').fill(PASSCODE)
  await page.getByRole("button", { name: /unlock dashboard/i }).click()
  await page.waitForURL(/\/dashboard$/)
}
