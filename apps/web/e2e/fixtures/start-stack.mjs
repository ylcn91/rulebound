#!/usr/bin/env node
// Boots the dashboard e2e stack:
//   1. A small Hono fixture backend on FIXTURE_PORT (default 3101) that
//      returns canonical Rulebound API response shapes. The fixture is
//      stateful enough that CRUD specs (rules, projects, webhooks) round
//      trip through create -> list -> delete without dragging Postgres or
//      the real server into the dashboard suite. The full server is
//      covered by packages/server/src/__tests__/integration/**.
//   2. `next start` on E2E_PORT (default 3100) pointed at the fixture.
//
// playwright.config.ts wires this as its webServer command; tests just
// see http://127.0.0.1:3100 with a working backend.

import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WEB_ROOT = resolve(__dirname, "..", "..")

const FIXTURE_PORT = Number(process.env.FIXTURE_BACKEND_PORT ?? 3101)
const WEB_PORT = Number(process.env.E2E_PORT ?? 3100)
const PASSCODE = process.env.E2E_DASHBOARD_PASSCODE ?? "e2e-passcode"
const API_TOKEN = "svc_e2e_token"

async function startFixtureBackend() {
  const { startFixtureServer } = await import("./backend.mjs")
  return startFixtureServer({ port: FIXTURE_PORT, expectedToken: API_TOKEN })
}

function startNext() {
  const env = {
    ...process.env,
    PORT: String(WEB_PORT),
    // We use `next dev` rather than `next start` for the e2e stack:
    // `next start` forces NODE_ENV=production, which in turn makes
    // app/api/dashboard-auth/session/route.ts set `secure: true` on the
    // session cookie. The e2e fixture runs on plain HTTP so a Secure
    // cookie would never round-trip and every test would bounce back to
    // /access. The Wave 4 plan calls out that the e2e suite is the
    // dashboard's preview-grade gate; the production cookie story is
    // exercised by the unit tests under apps/web/__tests__/.
    NODE_ENV: "development",
    RULEBOUND_API_URL: `http://127.0.0.1:${FIXTURE_PORT}`,
    RULEBOUND_API_TOKEN: API_TOKEN,
    RULEBOUND_DASHBOARD_PASSCODE: PASSCODE,
  }
  const proc = spawn(
    "pnpm",
    ["exec", "next", "dev", "--port", String(WEB_PORT)],
    {
      cwd: WEB_ROOT,
      env,
      stdio: "inherit",
    },
  )
  proc.on("exit", (code) => {
    process.exit(code ?? 0)
  })
  return proc
}

const backend = await startFixtureBackend()
console.log(`[e2e] fixture backend listening on http://127.0.0.1:${FIXTURE_PORT}`)
const next = startNext()
console.log(`[e2e] next start launching on http://127.0.0.1:${WEB_PORT}`)

const shutdown = () => {
  if (next && !next.killed) next.kill("SIGTERM")
  if (backend && typeof backend.close === "function") backend.close()
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
process.on("exit", shutdown)
