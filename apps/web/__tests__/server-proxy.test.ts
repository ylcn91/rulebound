import { afterEach, describe, expect, it, vi } from "vitest";

async function importProxyModule() {
  vi.resetModules();
  return import("../lib/server-proxy");
}

describe("server proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("forwards request to server api with auth", async () => {
    vi.stubEnv("RULEBOUND_API_URL", "http://localhost:3001");
    vi.stubEnv("RULEBOUND_API_TOKEN", "token");
    vi.stubEnv("RULEBOUND_DASHBOARD_PASSCODE", "secret");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { proxyToRulebound } = await importProxyModule();
    const response = await proxyToRulebound(
      new Request("http://localhost/api/rules", {
        method: "GET",
        headers: {
          cookie: "rulebound_dashboard_session=secret",
        },
      }),
      "/rules",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/v1/rules",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(response.status).toBe(200);
  });
});
