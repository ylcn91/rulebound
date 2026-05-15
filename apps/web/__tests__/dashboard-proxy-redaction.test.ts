/**
 * SEC-004 — Dashboard proxy redaction contract.
 *
 * Goal: pin the contract that when `apps/web/lib/server-proxy.ts` echoes
 * upstream error material back to the caller (or to logs), it does not
 * forward secret patterns verbatim.
 *
 * Current behavior surfaced by this suite:
 *   - Success path: proxy forwards the upstream body as a raw stream
 *     (`new NextResponse(response.body, ...)`). No redaction is applied
 *     to success bodies — this is acceptable because the dashboard caller
 *     is already authenticated against the upstream Rulebound API and the
 *     body never lands in server-side logs.
 *   - Error/exception path: proxy serialises a thin JSON shape
 *     `{ error, code, missingEnv? }`. Error messages come from
 *     `describeApiError(...)` in `apps/web/lib/api.ts`.
 *
 * Known gap (documented, NOT silently green): upstream 4xx/5xx bodies are
 * streamed through verbatim — if the upstream Rulebound server returns a
 * payload like `{ error: "Bearer <leaked> rejected" }`, the dashboard
 * relays it as-is to the browser. SEC-004 follow-up for Team B (owner of
 * `apps/web/lib/server-proxy.ts`) is to apply `@rulebound/shared`'s
 * `redactSensitive()` to error bodies before forwarding/logging.
 *
 * This file therefore asserts:
 *   1. The proxy never *generates* secret-shaped strings on its own
 *      (sanity check on the error envelope it builds).
 *   2. The redaction pattern set we expect Team B to wire is *correct*
 *      (covered by an in-file pure helper, kept identical to the shared
 *      logger's pattern list — drift here would silently weaken the
 *      Wave 2 / SEC-004 follow-up).
 *   3. An explicit `it.todo()` so the gap is visible in test output.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

async function importProxyModule() {
  vi.resetModules()
  return import("../lib/server-proxy")
}

// ── Local copy of the shared SENSITIVE_KEY_PATTERNS list — drift-detected
// by the contract test in `packages/shared`. If a key is added there, this
// list must match.
const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /^authorization$/i,
  /^auth$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^x-api-key$/i,
  /token$/i,
  /^token/i,
  /apikey$/i,
  /api[-_]?key$/i,
  /secret$/i,
  /^secret/i,
  /password$/i,
  /passphrase$/i,
  /key$/i,
  /^key$/,
]

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key))
}

function redactSensitive<T>(value: T): T {
  return walk(value, 0) as T
}

function walk(value: unknown, depth: number): unknown {
  if (depth > 6 || value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1))
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? "[REDACTED]" : walk(v, depth + 1)
    }
    return out
  }
  return value
}

describe("dashboard proxy — redaction contract", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  // (1) Proxy never embeds upstream credentials in its OWN error envelope.
  it("CONFIG_MISSING error envelope does not include any token value", async () => {
    // Both env vars unset.
    vi.stubEnv("RULEBOUND_API_URL", "")
    vi.stubEnv("RULEBOUND_API_TOKEN", "")
    vi.stubEnv("RULEBOUND_DASHBOARD_PASSCODE", "secret-passcode-001")

    const { proxyToRulebound } = await importProxyModule()
    const res = await proxyToRulebound(
      new Request("http://localhost/api/rules", {
        method: "GET",
        headers: { cookie: "rulebound_dashboard_session=secret-passcode-001" },
      }),
      "/rules",
    )

    expect(res.status).toBe(503)
    const body = await res.text()
    // The proxy must never echo the dashboard passcode (or anything that
    // looks like a token value) in its own error JSON.
    expect(body).not.toContain("secret-passcode-001")
    expect(body).toContain("missingEnv")
  })

  // (2) The redaction pattern set we expect Team B to apply behaves
  // correctly for typical upstream error payloads. Test the helper, not
  // the proxy itself — keeps the assertion deterministic until SEC-004
  // wiring lands in `server-proxy.ts`.
  it("redactSensitive() scrubs Authorization, Cookie, api_key, token, password keys", () => {
    const upstreamError = {
      error: "Upstream rejected",
      details: {
        request: {
          headers: {
            Authorization: "Bearer leak-up-1",
            Cookie: "session=leak-up-2",
            "X-API-Key": "leak-up-3",
          },
          body: {
            password: "leak-up-4",
            api_key: "leak-up-5",
            token: "leak-up-6",
            secret: "leak-up-7",
            non_sensitive: "safe-value",
          },
        },
      },
    }
    const redacted = redactSensitive(upstreamError)
    const serialized = JSON.stringify(redacted)

    expect(serialized).not.toMatch(/leak-up-\d/)
    expect(serialized).toContain("[REDACTED]")
    expect(serialized).toContain("safe-value")
  })

  it("redactSensitive() is recursive and handles arrays of objects", () => {
    const payload = {
      attempts: [
        { id: 1, token: "leak-arr-1" },
        { id: 2, password: "leak-arr-2" },
      ],
    }
    const out = redactSensitive(payload) as {
      attempts: Array<{ id: number; token?: string; password?: string }>
    }
    expect(out.attempts[0]?.token).toBe("[REDACTED]")
    expect(out.attempts[1]?.password).toBe("[REDACTED]")
    expect(out.attempts[0]?.id).toBe(1)
    expect(out.attempts[1]?.id).toBe(2)
  })

  // (3) Documented follow-up: wire `redactSensitive` into the proxy
  // error/log path. Owned by Team B (apps/web/lib/server-proxy.ts is in
  // their scope per lead-decisions §6).
  it.todo(
    "server-proxy.ts should pass upstream error bodies through redactSensitive() before forwarding or logging (Team B SEC-004 follow-up)",
  )
})
