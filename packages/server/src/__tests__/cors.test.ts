import { describe, it, expect } from "vitest"
import { Hono } from "hono"
import { cors } from "hono/cors"
import {
  originAllowedFor,
  parseAllowedOrigins,
} from "../lib/cors-policy.js"

function buildApp(env: Record<string, string | undefined>) {
  const app = new Hono()
  app.use(
    "*",
    cors({
      origin: (origin) => originAllowedFor(origin, env),
    }),
  )
  app.get("/test", (c) => c.json({ ok: true }))
  return app
}

describe("parseAllowedOrigins", () => {
  it("parses comma-separated env list and trims whitespace", () => {
    expect(
      parseAllowedOrigins({
        RULEBOUND_ALLOWED_ORIGINS: " https://a.example , https://b.example ",
        NODE_ENV: "production",
      }),
    ).toEqual(["https://a.example", "https://b.example"])
  })

  it("returns dev default when env unset and NODE_ENV is not production", () => {
    expect(parseAllowedOrigins({ NODE_ENV: "development" })).toEqual([
      "http://localhost:3000",
    ])
    expect(parseAllowedOrigins({})).toEqual(["http://localhost:3000"])
  })

  it("returns empty list when env unset and NODE_ENV is production", () => {
    expect(parseAllowedOrigins({ NODE_ENV: "production" })).toEqual([])
  })

  it("treats empty / whitespace env as unset", () => {
    expect(
      parseAllowedOrigins({
        RULEBOUND_ALLOWED_ORIGINS: "   ",
        NODE_ENV: "production",
      }),
    ).toEqual([])
  })
})

describe("originAllowedFor", () => {
  it("returns null when request has no Origin header", () => {
    expect(originAllowedFor(undefined, { NODE_ENV: "production" })).toBeNull()
  })

  it("returns the origin when present in the configured allowlist", () => {
    expect(
      originAllowedFor("https://app.example", {
        RULEBOUND_ALLOWED_ORIGINS: "https://app.example",
        NODE_ENV: "production",
      }),
    ).toBe("https://app.example")
  })

  it("returns null when origin is not on the list", () => {
    expect(
      originAllowedFor("https://evil.example", {
        RULEBOUND_ALLOWED_ORIGINS: "https://app.example",
        NODE_ENV: "production",
      }),
    ).toBeNull()
  })

  it("dev default allows http://localhost:3000", () => {
    expect(
      originAllowedFor("http://localhost:3000", { NODE_ENV: "development" }),
    ).toBe("http://localhost:3000")
  })

  it("dev default blocks origins outside localhost:3000", () => {
    expect(
      originAllowedFor("https://app.example", { NODE_ENV: "development" }),
    ).toBeNull()
  })
})

describe("CORS middleware wiring", () => {
  it("echoes Access-Control-Allow-Origin for allowed browser origin", async () => {
    const app = buildApp({
      RULEBOUND_ALLOWED_ORIGINS: "https://app.example",
      NODE_ENV: "production",
    })
    const res = await app.request("/test", {
      headers: { Origin: "https://app.example" },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.example",
    )
  })

  it("omits Access-Control-Allow-Origin for disallowed browser origin", async () => {
    const app = buildApp({
      RULEBOUND_ALLOWED_ORIGINS: "https://app.example",
      NODE_ENV: "production",
    })
    const res = await app.request("/test", {
      headers: { Origin: "https://evil.example" },
    })
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })

  it("does not set CORS headers for requests without Origin (server-to-server)", async () => {
    const app = buildApp({ NODE_ENV: "production" })
    const res = await app.request("/test")
    expect(res.status).toBe(200)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })

  it("prod default blocks browser requests when env unset", async () => {
    const app = buildApp({ NODE_ENV: "production" })
    const res = await app.request("/test", {
      headers: { Origin: "http://localhost:3000" },
    })
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })

  it("dev default allows localhost:3000 without explicit env", async () => {
    const app = buildApp({ NODE_ENV: "development" })
    const res = await app.request("/test", {
      headers: { Origin: "http://localhost:3000" },
    })
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    )
  })
})
