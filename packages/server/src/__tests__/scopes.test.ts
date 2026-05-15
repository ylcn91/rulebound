import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Hono } from "hono"
import {
  DEFAULT_TOKEN_SCOPES,
  LEGACY_SCOPE_MAPPING,
  SCOPES,
  expandLegacyScope,
  findLegacyScopes,
  isKnownScope,
  resolveEffectiveScopes,
} from "../lib/scopes.js"
import { requireScope } from "../middleware/require-scope.js"

function makeApp(
  scope: Parameters<typeof requireScope>[0],
  setIdentity: (c: import("hono").Context) => void,
) {
  const app = new Hono()
  app.use("*", async (c, next) => {
    setIdentity(c)
    await next()
  })
  app.get("/test", requireScope(scope), (c) => c.json({ ok: true }))
  return app
}

describe("scope taxonomy constants", () => {
  it("exports the 11 binding scopes from lead verdict B4", () => {
    expect(SCOPES).toEqual([
      "rules:read",
      "rules:write",
      "projects:read",
      "projects:write",
      "audit:read",
      "audit:write",
      "tokens:write",
      "webhooks:write",
      "validate:run",
      "compliance:read",
      "sync:write",
    ])
    expect(SCOPES).toHaveLength(11)
  })

  it("maps legacy 'read' to every fine-grained read scope", () => {
    expect(LEGACY_SCOPE_MAPPING.read).toEqual([
      "audit:read",
      "rules:read",
      "projects:read",
      "compliance:read",
    ])
  })

  it("maps legacy 'validate' to validate:run", () => {
    expect(LEGACY_SCOPE_MAPPING.validate).toEqual(["validate:run"])
  })

  it("default token scopes are conservative (read + validate, no writes)", () => {
    expect(DEFAULT_TOKEN_SCOPES).toEqual([
      "audit:read",
      "rules:read",
      "validate:run",
    ])
  })

  it("isKnownScope rejects legacy strings and unknown values", () => {
    expect(isKnownScope("rules:read")).toBe(true)
    expect(isKnownScope("read")).toBe(false)
    expect(isKnownScope("totally:made-up")).toBe(false)
  })

  it("expandLegacyScope returns null for unknown values", () => {
    expect(expandLegacyScope("read")).toEqual([
      "audit:read",
      "rules:read",
      "projects:read",
      "compliance:read",
    ])
    expect(expandLegacyScope("totally:made-up")).toBeNull()
  })

  it("resolveEffectiveScopes mixes legacy and new strings, drops unknowns", () => {
    const result = resolveEffectiveScopes([
      "read",
      "rules:write",
      "totally:made-up",
    ])
    expect(result.has("audit:read")).toBe(true)
    expect(result.has("rules:read")).toBe(true)
    expect(result.has("rules:write")).toBe(true)
    expect(result.has("totally:made-up" as never)).toBe(false)
  })

  it("findLegacyScopes flags only legacy strings", () => {
    expect(findLegacyScopes(["read", "rules:read", "validate"])).toEqual([
      "read",
      "validate",
    ])
    expect(findLegacyScopes(["rules:read"])).toEqual([])
  })
})

describe("requireScope middleware", () => {
  const originalEnv = process.env.RULEBOUND_LEGACY_TOKEN_SCOPES

  beforeEach(() => {
    delete process.env.RULEBOUND_LEGACY_TOKEN_SCOPES
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RULEBOUND_LEGACY_TOKEN_SCOPES
    } else {
      process.env.RULEBOUND_LEGACY_TOKEN_SCOPES = originalEnv
    }
  })

  it("401s when identity is missing", async () => {
    const app = makeApp("rules:read", () => {})
    const res = await app.request("/test")
    expect(res.status).toBe(401)
  })

  it("passes when token has the required scope", async () => {
    const app = makeApp("rules:read", (c) => {
      c.set("orgId" as never, "org-1" as never)
      c.set("userId" as never, "user-1" as never)
      c.set("tokenScopes" as never, ["rules:read"] as never)
    })
    const res = await app.request("/test")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })

  it("passes when token uses legacy 'read' string that maps to the required scope", async () => {
    const app = makeApp("rules:read", (c) => {
      c.set("orgId" as never, "org-1" as never)
      c.set("userId" as never, "user-1" as never)
      c.set("tokenScopes" as never, ["read"] as never)
    })
    const res = await app.request("/test")
    expect(res.status).toBe(200)
  })

  it("403s with required-list payload when scope is missing", async () => {
    const app = makeApp("rules:write", (c) => {
      c.set("orgId" as never, "org-1" as never)
      c.set("userId" as never, "user-1" as never)
      c.set("tokenScopes" as never, ["rules:read"] as never)
    })
    const res = await app.request("/test")
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Missing scope")
    expect(body.required).toEqual(["rules:write"])
  })

  it("403s when raw scope array is empty and legacy bypass is OFF", async () => {
    const app = makeApp("rules:read", (c) => {
      c.set("orgId" as never, "org-1" as never)
      c.set("userId" as never, "user-1" as never)
      c.set("tokenScopes" as never, [] as never)
    })
    const res = await app.request("/test")
    expect(res.status).toBe(403)
  })

  it("legacy bypass: empty scope array authenticates when RULEBOUND_LEGACY_TOKEN_SCOPES=1", async () => {
    process.env.RULEBOUND_LEGACY_TOKEN_SCOPES = "1"
    const app = makeApp("rules:read", (c) => {
      c.set("orgId" as never, "org-1" as never)
      c.set("userId" as never, "user-1" as never)
      c.set("tokenScopes" as never, [] as never)
    })
    const res = await app.request("/test")
    expect(res.status).toBe(200)
  })

  it("legacy bypass: token with non-empty scopes still must satisfy requirement", async () => {
    process.env.RULEBOUND_LEGACY_TOKEN_SCOPES = "1"
    const app = makeApp("rules:write", (c) => {
      c.set("orgId" as never, "org-1" as never)
      c.set("userId" as never, "user-1" as never)
      c.set("tokenScopes" as never, ["rules:read"] as never)
    })
    const res = await app.request("/test")
    expect(res.status).toBe(403)
  })
})
