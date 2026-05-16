import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

function sameOriginHeaders(extra?: HeadersInit): Headers {
  return new Headers({
    host: "localhost",
    origin: "http://localhost",
    ...Object.fromEntries(new Headers(extra)),
  })
}

function importJsonRequest(cookie?: string): Request {
  const headers = sameOriginHeaders({
    "content-type": "application/json",
    ...(cookie ? { cookie } : {}),
  })

  return new Request("http://localhost/api/import", {
    method: "POST",
    headers,
    body: JSON.stringify({
      content: "## Security\nMUST protect dashboard imports",
    }),
  })
}

function sessionRequest(next: string): NextRequest {
  const form = new FormData()
  form.set("passcode", "secret")
  form.set("next", next)

  return new NextRequest("http://localhost/api/dashboard-auth/session", {
    method: "POST",
    headers: sameOriginHeaders(),
    body: form,
  })
}

async function importImportRoute() {
  vi.resetModules()
  return import("@/app/api/import/route")
}

async function importSessionRoute() {
  vi.resetModules()
  return import("@/app/api/dashboard-auth/session/route")
}

async function importProxyModule() {
  vi.resetModules()
  return import("../proxy")
}

describe("auth security", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("/api/import rejects same-origin requests without a dashboard session", async () => {
    vi.stubEnv("RULEBOUND_DASHBOARD_PASSCODE", "secret")

    const { POST } = await importImportRoute()
    const response = await POST(importJsonRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Dashboard authorization required.",
    })
  })

  it("/api/import accepts same-origin requests with a valid dashboard session", async () => {
    vi.stubEnv("RULEBOUND_DASHBOARD_PASSCODE", "secret")

    const { POST } = await importImportRoute()
    const response = await POST(
      importJsonRequest("rulebound_dashboard_session=secret"),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        count: 1,
        source: "paste",
      },
    })
  })

  it("the web proxy protects /api/import before the route handler runs", async () => {
    vi.stubEnv("RULEBOUND_DASHBOARD_PASSCODE", "secret")

    const { config, proxy } = await importProxyModule()
    const response = proxy(new NextRequest("http://localhost/api/import"))

    expect(config.matcher).toContain("/api/import/:path*")
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Dashboard authorization required.",
    })
  })

  it("dashboard-auth allows only single-slash relative next redirects", async () => {
    vi.stubEnv("RULEBOUND_DASHBOARD_PASSCODE", "secret")

    const { POST } = await importSessionRoute()
    const allowed = await POST(sessionRequest("/rules/new?from=access#details"))

    expect(allowed.headers.get("location")).toBe(
      "http://localhost/rules/new?from=access#details",
    )

    const rejectedNextValues = [
      "//evil.test/dashboard",
      "/\\evil.test/dashboard",
      "/%2f%2fevil.test/dashboard",
      "/%5c%5cevil.test/dashboard",
      "/%252f%252fevil.test/dashboard",
      "/dashboard%5c%5cevil.test",
      "/dashboard\nLocation:%20https://evil.test",
    ]

    for (const next of rejectedNextValues) {
      const response = await POST(sessionRequest(next))
      expect(response.headers.get("location")).toBe("http://localhost/dashboard")
    }
  })
})
