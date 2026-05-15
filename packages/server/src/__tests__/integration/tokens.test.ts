import { describe, it, expect } from "vitest"
import { authHeaders, buildApp, seedOrgAndToken } from "./helpers.js"

describe("integration: /v1/tokens", () => {
  it("creates, lists, and deletes tokens against a real Postgres", async () => {
    const seed = await seedOrgAndToken()
    const app = buildApp()

    const listEmpty = await app.request("/v1/tokens", {
      headers: authHeaders(seed.token),
    })
    expect(listEmpty.status).toBe(200)
    const listEmptyBody = await listEmpty.json()
    // Seeded token shows up in the list.
    expect(Array.isArray(listEmptyBody.data)).toBe(true)
    const initialCount = listEmptyBody.data.length

    const create = await app.request("/v1/tokens", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({
        name: "ci-bot",
        scopes: ["rules:read", "validate:run"],
      }),
    })
    expect(create.status).toBe(201)
    const created = await create.json()
    expect(created.data.token).toMatch(/^rb_/)
    expect(created.data.scopes).toEqual(["rules:read", "validate:run"])

    const list = await app.request("/v1/tokens", {
      headers: authHeaders(seed.token),
    })
    expect(list.status).toBe(200)
    const listBody = await list.json()
    expect(listBody.data.length).toBe(initialCount + 1)

    const del = await app.request(`/v1/tokens/${created.data.id}`, {
      method: "DELETE",
      headers: authHeaders(seed.token),
    })
    expect(del.status).toBe(200)
  })

  it("enforces org isolation: tokens from one org are invisible to another", async () => {
    const seedA = await seedOrgAndToken()
    const seedB = await seedOrgAndToken()
    const app = buildApp()

    const created = await app.request("/v1/tokens", {
      method: "POST",
      headers: authHeaders(seedA.token),
      body: JSON.stringify({ name: "org-a-only" }),
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    const newTokenId = createdBody.data.id

    const fromB = await app.request("/v1/tokens", {
      headers: authHeaders(seedB.token),
    })
    expect(fromB.status).toBe(200)
    const fromBBody = await fromB.json()
    const ids = fromBBody.data.map((t: { id: string }) => t.id)
    expect(ids).not.toContain(newTokenId)
  })

  it("rejects tokens missing tokens:write scope on create", async () => {
    const seed = await seedOrgAndToken({ scopes: ["rules:read"] })
    const app = buildApp()
    const res = await app.request("/v1/tokens", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({ name: "denied" }),
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Missing scope")
    expect(body.required).toEqual(["tokens:write"])
  })
})
