import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  apiFetch,
  describeApiError,
  normalizeApiPath,
} from "@/lib/api"
import { proxyToRulebound } from "@/lib/server-proxy"

const ORIGINAL_API_URL = process.env.RULEBOUND_API_URL
const ORIGINAL_API_TOKEN = process.env.RULEBOUND_API_TOKEN
const ORIGINAL_DASHBOARD_PASSCODE = process.env.RULEBOUND_DASHBOARD_PASSCODE

function restoreEnv() {
  if (ORIGINAL_API_URL === undefined) {
    delete process.env.RULEBOUND_API_URL
  } else {
    process.env.RULEBOUND_API_URL = ORIGINAL_API_URL
  }

  if (ORIGINAL_API_TOKEN === undefined) {
    delete process.env.RULEBOUND_API_TOKEN
  } else {
    process.env.RULEBOUND_API_TOKEN = ORIGINAL_API_TOKEN
  }

  if (ORIGINAL_DASHBOARD_PASSCODE === undefined) {
    delete process.env.RULEBOUND_DASHBOARD_PASSCODE
  } else {
    process.env.RULEBOUND_DASHBOARD_PASSCODE = ORIGINAL_DASHBOARD_PASSCODE
  }
}

describe("rulebound api helpers", () => {
  beforeEach(() => {
    process.env.RULEBOUND_API_URL = "https://rulebound.test"
    process.env.RULEBOUND_API_TOKEN = "svc_test_token"
    process.env.RULEBOUND_DASHBOARD_PASSCODE = "secret"
  })

  afterEach(() => {
    restoreEnv()
    vi.unstubAllGlobals()
  })

  it("keeps a single /v1 prefix", () => {
    expect(normalizeApiPath("/rules")).toBe("/v1/rules")
    expect(normalizeApiPath("/v1/analytics/top-violations")).toBe(
      "/v1/analytics/top-violations"
    )
  })

  it("attaches the service token without double-prefixing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ count: 1 }] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const response = await apiFetch<{ data: Array<{ count: number }> }>(
      "/v1/analytics/top-violations"
    )

    expect(response).toEqual({ data: [{ count: 1 }] })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://rulebound.test/v1/analytics/top-violations"
    )

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(headers.get("authorization")).toBe("Bearer svc_test_token")
  })

  it("preserves csv headers when proxying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("id,action\n1,validation.violation\n", {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="audit.csv"',
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const response = await proxyToRulebound(
      new Request("http://localhost/api/audit/export?since=2026-01-01", {
        headers: {
          cookie: "rulebound_dashboard_session=secret",
        },
      }),
      "/audit/export?since=2026-01-01"
    )

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://rulebound.test/v1/audit/export?since=2026-01-01"
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="audit.csv"'
    )
    await expect(response.text()).resolves.toContain("validation.violation")
  })

  it("reports missing env deterministically", async () => {
    delete process.env.RULEBOUND_API_URL
    delete process.env.RULEBOUND_API_TOKEN

    let caught: unknown

    try {
      await apiFetch("/rules")
    } catch (error) {
      caught = error
    }

    const description = describeApiError(caught)
    expect(description.title).toBe("Backend Configuration Missing")
    expect(description.description).toContain("RULEBOUND_API_URL")
    expect(description.description).toContain("RULEBOUND_API_TOKEN")
  })
})
