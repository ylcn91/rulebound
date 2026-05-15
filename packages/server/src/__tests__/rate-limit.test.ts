import { describe, it, expect, beforeEach } from "vitest"
import { Hono } from "hono"
import { rateLimit, __testing } from "../middleware/rate-limit.js"

interface ClockHandle {
  now: () => number
  advance: (ms: number) => void
  set: (ms: number) => void
}

function makeClock(start = 1_700_000_000_000): ClockHandle {
  let t = start
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
    set: (ms: number) => {
      t = ms
    },
  }
}

interface BuildAppOpts {
  env?: NodeJS.ProcessEnv
  clock: ClockHandle
  setIdentity?: (c: import("hono").Context) => void
  maxEntries?: number
}

function buildApp({ env = {}, clock, setIdentity, maxEntries }: BuildAppOpts) {
  const app = new Hono()
  app.use("*", async (c, next) => {
    setIdentity?.(c)
    await next()
  })
  app.get(
    "/health",
    rateLimit({ env, now: clock.now, maxEntries }),
    (c) => c.json({ status: "ok" }),
  )
  app.get(
    "/v1/anything",
    rateLimit({ env, now: clock.now, maxEntries }),
    (c) => c.json({ ok: true }),
  )
  return app
}

function setOrg(orgId: string) {
  return (c: import("hono").Context) => {
    c.set("orgId" as never, orgId as never)
    c.set("userId" as never, "user-1" as never)
    c.set("tokenScopes" as never, ["rules:read"] as never)
  }
}

describe("rate limiter — default-off behaviour", () => {
  it("is a no-op when neither env is set", async () => {
    const clock = makeClock()
    const app = buildApp({ clock, setIdentity: setOrg("org-1") })

    for (let i = 0; i < 200; i++) {
      const res = await app.request("/v1/anything")
      expect(res.status).toBe(200)
    }
  })
})

describe("rate limiter — per-IP limit", () => {
  let clock: ClockHandle
  beforeEach(() => {
    clock = makeClock()
  })

  it("allows N requests then 429s with Retry-After header", async () => {
    const env = { RULEBOUND_RATE_LIMIT_PER_MIN_IP: "3" }
    const app = buildApp({ env, clock, setIdentity: setOrg("org-1") })

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/v1/anything", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      })
      expect(res.status).toBe(200)
    }

    const blocked = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    })
    expect(blocked.status).toBe(429)
    const retry = blocked.headers.get("Retry-After")
    expect(retry).toBeDefined()
    expect(Number.parseInt(retry ?? "0", 10)).toBeGreaterThan(0)
    const body = await blocked.json()
    expect(body.error).toBe("Rate limit exceeded")
    expect(typeof body.retryAfter).toBe("number")
    expect(body.retryAfter).toBeGreaterThan(0)
  })

  it("isolates buckets per IP", async () => {
    const env = { RULEBOUND_RATE_LIMIT_PER_MIN_IP: "2" }
    const app = buildApp({ env, clock, setIdentity: setOrg("org-1") })

    for (let i = 0; i < 2; i++) {
      const res = await app.request("/v1/anything", {
        headers: { "x-forwarded-for": "1.1.1.1" },
      })
      expect(res.status).toBe(200)
    }
    const blocked = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    })
    expect(blocked.status).toBe(429)

    // Different IP starts from a fresh bucket.
    const fresh = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "2.2.2.2" },
    })
    expect(fresh.status).toBe(200)
  })

  it("refills tokens at the configured rate", async () => {
    const env = { RULEBOUND_RATE_LIMIT_PER_MIN_IP: "60" }
    const app = buildApp({ env, clock, setIdentity: setOrg("org-1") })

    // Burn the full bucket of 60.
    for (let i = 0; i < 60; i++) {
      const res = await app.request("/v1/anything", {
        headers: { "x-forwarded-for": "5.5.5.5" },
      })
      expect(res.status).toBe(200)
    }
    const blocked = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "5.5.5.5" },
    })
    expect(blocked.status).toBe(429)

    // 1s -> 60/60 = 1 token refilled. One request should succeed; the next 429.
    clock.advance(1_000)
    const refilled = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "5.5.5.5" },
    })
    expect(refilled.status).toBe(200)
    const second = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "5.5.5.5" },
    })
    expect(second.status).toBe(429)

    // After a full minute the entire bucket is back.
    clock.advance(60_000)
    for (let i = 0; i < 60; i++) {
      const res = await app.request("/v1/anything", {
        headers: { "x-forwarded-for": "5.5.5.5" },
      })
      expect(res.status).toBe(200)
    }
  })

  it("groups callers without forwarded-for under the 'unknown' bucket", async () => {
    const env = { RULEBOUND_RATE_LIMIT_PER_MIN_IP: "2" }
    const app = buildApp({ env, clock, setIdentity: setOrg("org-1") })

    for (let i = 0; i < 2; i++) {
      const res = await app.request("/v1/anything")
      expect(res.status).toBe(200)
    }
    const blocked = await app.request("/v1/anything")
    expect(blocked.status).toBe(429)
  })
})

describe("rate limiter — per-token limit", () => {
  let clock: ClockHandle
  beforeEach(() => {
    clock = makeClock()
  })

  it("limits per orgId regardless of source IP", async () => {
    const env = { RULEBOUND_RATE_LIMIT_PER_MIN_TOKEN: "2" }
    const app = buildApp({ env, clock, setIdentity: setOrg("org-A") })

    for (let i = 0; i < 2; i++) {
      const res = await app.request("/v1/anything", {
        headers: { "x-forwarded-for": `9.9.9.${i + 1}` },
      })
      expect(res.status).toBe(200)
    }
    const blocked = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "9.9.9.99" },
    })
    expect(blocked.status).toBe(429)
  })

  it("isolates token buckets per orgId", async () => {
    const env = { RULEBOUND_RATE_LIMIT_PER_MIN_TOKEN: "1" }
    let identityOrg = "org-A"
    const app = buildApp({
      env,
      clock,
      setIdentity: (c) => {
        c.set("orgId" as never, identityOrg as never)
        c.set("userId" as never, "user-1" as never)
        c.set("tokenScopes" as never, ["rules:read"] as never)
      },
    })

    const aFirst = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    })
    expect(aFirst.status).toBe(200)
    const aSecond = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    })
    expect(aSecond.status).toBe(429)

    identityOrg = "org-B"
    const bFirst = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    })
    expect(bFirst.status).toBe(200)
  })

  it("skips the per-token bucket when no identity is present", async () => {
    const env = { RULEBOUND_RATE_LIMIT_PER_MIN_TOKEN: "1" }
    // Anonymous: no setIdentity wired
    const app = buildApp({ env, clock })

    // With no identity and no IP limit, every request still passes through.
    for (let i = 0; i < 5; i++) {
      const res = await app.request("/v1/anything", {
        headers: { "x-forwarded-for": "7.7.7.7" },
      })
      expect(res.status).toBe(200)
    }
  })
})

describe("rate limiter — health route exemption", () => {
  it("never rate-limits /health", async () => {
    const clock = makeClock()
    const env = { RULEBOUND_RATE_LIMIT_PER_MIN_IP: "1" }
    const app = buildApp({ env, clock, setIdentity: setOrg("org-1") })

    for (let i = 0; i < 50; i++) {
      const res = await app.request("/health", {
        headers: { "x-forwarded-for": "8.8.8.8" },
      })
      expect(res.status).toBe(200)
    }
  })
})

describe("rate limiter — combined token+ip limits", () => {
  it("returns 429 when whichever limit hits first", async () => {
    const clock = makeClock()
    const env = {
      RULEBOUND_RATE_LIMIT_PER_MIN_TOKEN: "100",
      RULEBOUND_RATE_LIMIT_PER_MIN_IP: "2",
    }
    const app = buildApp({ env, clock, setIdentity: setOrg("org-1") })

    for (let i = 0; i < 2; i++) {
      const res = await app.request("/v1/anything", {
        headers: { "x-forwarded-for": "3.3.3.3" },
      })
      expect(res.status).toBe(200)
    }
    const blocked = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "3.3.3.3" },
    })
    expect(blocked.status).toBe(429)
  })
})

describe("rate limiter — LRU eviction cap", () => {
  it("evicts the oldest-touched bucket once maxEntries is exceeded", async () => {
    const clock = makeClock()
    const env = { RULEBOUND_RATE_LIMIT_PER_MIN_IP: "1" }
    const app = buildApp({ env, clock, maxEntries: 3 })

    // Fill three distinct IPs to capacity.
    for (const ip of ["10.0.0.1", "10.0.0.2", "10.0.0.3"]) {
      const ok = await app.request("/v1/anything", {
        headers: { "x-forwarded-for": ip },
      })
      expect(ok.status).toBe(200)
      const blocked = await app.request("/v1/anything", {
        headers: { "x-forwarded-for": ip },
      })
      expect(blocked.status).toBe(429)
    }

    // 4th distinct IP must evict the oldest (10.0.0.1).
    const newOk = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "10.0.0.4" },
    })
    expect(newOk.status).toBe(200)

    // 10.0.0.1 was evicted — its first new request gets a fresh bucket.
    const evictedRevisit = await app.request("/v1/anything", {
      headers: { "x-forwarded-for": "10.0.0.1" },
    })
    expect(evictedRevisit.status).toBe(200)
  })
})

describe("rate limiter — internal constants", () => {
  it("exposes WINDOW_MS and DEFAULT_MAX_ENTRIES for visibility", () => {
    expect(__testing.WINDOW_MS).toBe(60_000)
    expect(__testing.DEFAULT_MAX_ENTRIES).toBe(10_000)
  })
})
