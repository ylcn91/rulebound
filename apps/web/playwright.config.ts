import { defineConfig, devices } from "@playwright/test"

/**
 * Dashboard e2e config. Single Chromium project; the dashboard is
 * preview-only and we are not promising cross-browser parity (see
 * `docs/dashboard-readiness.md`).
 *
 * The web server hook spins `next start` against the e2e-only env so the
 * suite does not depend on a developer-running `pnpm dev`. A small Hono
 * fixture server is booted by `e2e/fixtures/backend.ts` and exposed via
 * `RULEBOUND_API_URL` so the dashboard hits canonical response shapes
 * without dragging the full server + Postgres into the loop. The full
 * server is covered by `packages/server/src/__tests__/integration/**`.
 *
 * Acceptance command: `pnpm --filter @rulebound/web test:e2e`.
 *
 * Browser availability: this config assumes `playwright install chromium`
 * has run. If browsers are absent (typical dev sandbox), Playwright fails
 * fast with a clear install-hint; CI nightly is the binding gate per the
 * Wave 4 plan.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    // Use `localhost` (not 127.0.0.1) because Next's dev server rewrites
    // redirect `Location` headers against the inbound Host header. If the
    // baseURL were 127.0.0.1 the post-login redirect would land on
    // `http://localhost/dashboard` and the session cookie set on
    // 127.0.0.1 would not flow with the request.
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node e2e/fixtures/start-stack.mjs",
    url: "http://localhost:3100/access",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  },
})
