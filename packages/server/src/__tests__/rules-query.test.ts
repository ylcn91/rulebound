import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(() => ({})),
  schema: {},
}))

vi.mock("../lib/rules.js", () => ({
  getAllOrgRuleSetIds: vi.fn(),
  getEffectiveRuleSetIds: vi.fn(),
  getOrgRuleById: vi.fn(),
  getOrCreateDefaultGlobalRuleSet: vi.fn(),
  resolveRulesForRuleSetIds: vi.fn(),
}))

vi.mock("../lib/projects.js", () => ({
  resolveProjectForOrg: vi.fn(),
}))

vi.mock("../lib/activity.js", () => ({
  emitWebhookEvent: vi.fn(),
  writeAuditEntry: vi.fn(),
}))

async function createApp() {
  const { rulesApi } = await import("../api/rules.js")
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("orgId" as never, "org-1" as never)
    c.set("userId" as never, "user-1" as never)
    c.set("tokenScopes" as never, ["rules:read"] as never)
    await next()
  })
  app.route("/rules", rulesApi)
  return app
}

describe("rules API query validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ["/rules?limit=abc", "limit"],
    ["/rules?limit=-1", "limit"],
    ["/rules?limit=0", "limit"],
    ["/rules?limit=501", "limit"],
    ["/rules?offset=-1", "offset"],
    ["/rules?offset=10001", "offset"],
  ])("rejects invalid pagination in %s", async (path, param) => {
    const app = await createApp()
    const res = await app.request(path)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Invalid query parameter")
    expect(body.details[0].param).toBe(param)
  })
})
