import { afterEach, describe, expect, it, vi } from "vitest";

async function importApiModule() {
  vi.resetModules();
  return import("../lib/api");
}

describe("rulebound api helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds /v1 urls exactly once", async () => {
    vi.stubEnv("RULEBOUND_API_URL", "http://localhost:3001/");
    vi.stubEnv("RULEBOUND_API_TOKEN", "token");

    const api = await importApiModule();
    expect(api.buildRuleboundApiUrl("/analytics/top-violations")).toBe(
      "http://localhost:3001/v1/analytics/top-violations",
    );
  });

  it("throws when service token is missing", async () => {
    vi.stubEnv("RULEBOUND_API_URL", "http://localhost:3001");
    vi.stubEnv("RULEBOUND_API_TOKEN", "");

    const api = await importApiModule();
    expect(() => api.buildRuleboundApiUrl("/rules")).toThrow(
      "Rulebound API configuration is missing.",
    );
  });

  it("adds bearer auth header", async () => {
    vi.stubEnv("RULEBOUND_API_URL", "http://localhost:3001");
    vi.stubEnv("RULEBOUND_API_TOKEN", "token");

    const api = await importApiModule();
    const headers = api.buildRuleboundApiHeaders();
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("Content-Type")).toBeNull();
  });
});
