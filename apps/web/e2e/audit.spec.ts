import { expect, test } from "@playwright/test"
import { login } from "./_helpers"

test.describe("audit page", () => {
  test("renders entries from the fixture backend", async ({ page }) => {
    await login(page)
    await page.goto("/audit")

    await expect(page.getByRole("heading", { name: /audit/i }).first()).toBeVisible()
    // The audit table renders rows for each entry; we assert the page
    // mounts and the BackendErrorState card is NOT visible (which would
    // mean the fixture API was unreachable).
    await expect(page.getByText(/backend unreachable|unavailable/i)).not.toBeVisible()
  })

  test("exports the audit log as CSV", async ({ page }) => {
    await login(page)
    await page.goto("/audit")

    const downloadPromise = page.waitForEvent("download")
    const exportButton = page.getByRole("link", { name: /export/i }).or(
      page.getByRole("button", { name: /export/i }),
    )
    await exportButton.first().click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/audit/i)
  })
})
