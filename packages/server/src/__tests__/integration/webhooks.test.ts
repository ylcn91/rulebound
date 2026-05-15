import { describe, it, expect } from "vitest"
import { authHeaders, buildApp, seedOrgAndToken } from "./helpers.js"

describe("integration: /v1/webhooks/endpoints", () => {
  it("creates and lists webhook endpoints", async () => {
    const seed = await seedOrgAndToken()
    const app = buildApp()

    const create = await app.request("/v1/webhooks/endpoints", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({
        url: "https://example.com/webhook",
        secret: "0123456789abcdef0123456789abcdef",
        events: ["rule.created"],
        description: "ci-test",
      }),
    })
    expect(create.status).toBe(201)
    const created = await create.json()
    expect(created.data.url).toBe("https://example.com/webhook")
    const endpointId = created.data.id

    const list = await app.request("/v1/webhooks/endpoints", {
      headers: authHeaders(seed.token),
    })
    expect(list.status).toBe(200)
    const body = await list.json()
    expect(body.data.some((e: { id: string }) => e.id === endpointId)).toBe(true)

    const del = await app.request(`/v1/webhooks/endpoints/${endpointId}`, {
      method: "DELETE",
      headers: authHeaders(seed.token),
    })
    expect(del.status).toBe(200)
  })

  it("rejects URLs pointing at private addresses", async () => {
    const seed = await seedOrgAndToken()
    const app = buildApp()

    const res = await app.request("/v1/webhooks/endpoints", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({
        url: "http://127.0.0.1/webhook",
        secret: "0123456789abcdef0123456789abcdef",
        events: ["rule.created"],
      }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Unsafe webhook URL")
    expect(typeof body.reason).toBe("string")
  })

  it("isolates endpoints by org", async () => {
    const seedA = await seedOrgAndToken()
    const seedB = await seedOrgAndToken()
    const app = buildApp()

    const create = await app.request("/v1/webhooks/endpoints", {
      method: "POST",
      headers: authHeaders(seedA.token),
      body: JSON.stringify({
        url: "https://example.com/webhook",
        secret: "0123456789abcdef0123456789abcdef",
        events: ["rule.created"],
      }),
    })
    const endpointId = (await create.json()).data.id

    const list = await app.request("/v1/webhooks/endpoints", {
      headers: authHeaders(seedB.token),
    })
    const ids = (await list.json()).data.map((e: { id: string }) => e.id)
    expect(ids).not.toContain(endpointId)
  })
})
