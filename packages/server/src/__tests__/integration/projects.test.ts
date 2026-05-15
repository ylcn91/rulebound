import { describe, it, expect } from "vitest"
import { authHeaders, buildApp, seedOrgAndToken } from "./helpers.js"

describe("integration: /v1/projects", () => {
  it("CRUDs projects against a real Postgres", async () => {
    const seed = await seedOrgAndToken()
    const app = buildApp()

    const create = await app.request("/v1/projects", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({
        name: "Integration Project",
        slug: "integration-project",
        stack: ["typescript"],
      }),
    })
    expect(create.status).toBe(201)
    const created = await create.json()
    expect(created.data.slug).toBe("integration-project")
    const projectId = created.data.id

    const list = await app.request("/v1/projects", {
      headers: authHeaders(seed.token),
    })
    expect(list.status).toBe(200)
    const listBody = await list.json()
    expect(listBody.data.some((p: { id: string }) => p.id === projectId)).toBe(true)

    const get = await app.request(`/v1/projects/${projectId}`, {
      headers: authHeaders(seed.token),
    })
    expect(get.status).toBe(200)

    const update = await app.request(`/v1/projects/${projectId}`, {
      method: "PUT",
      headers: authHeaders(seed.token),
      body: JSON.stringify({ name: "Renamed" }),
    })
    expect(update.status).toBe(200)

    const del = await app.request(`/v1/projects/${projectId}`, {
      method: "DELETE",
      headers: authHeaders(seed.token),
    })
    expect(del.status).toBe(200)

    const getAfter = await app.request(`/v1/projects/${projectId}`, {
      headers: authHeaders(seed.token),
    })
    expect(getAfter.status).toBe(404)
  })

  it("rejects duplicate slugs within an org", async () => {
    const seed = await seedOrgAndToken()
    const app = buildApp()

    const first = await app.request("/v1/projects", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({ name: "Dup", slug: "dup-slug" }),
    })
    expect(first.status).toBe(201)

    const second = await app.request("/v1/projects", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({ name: "Dup 2", slug: "dup-slug" }),
    })
    expect(second.status).toBe(409)
  })

  it("isolates projects by org", async () => {
    const seedA = await seedOrgAndToken()
    const seedB = await seedOrgAndToken()
    const app = buildApp()

    const createA = await app.request("/v1/projects", {
      method: "POST",
      headers: authHeaders(seedA.token),
      body: JSON.stringify({ name: "Org A Only", slug: "org-a-only" }),
    })
    expect(createA.status).toBe(201)
    const aProjectId = (await createA.json()).data.id

    // Org B cannot see org A's project at /v1/projects/:id
    const fromB = await app.request(`/v1/projects/${aProjectId}`, {
      headers: authHeaders(seedB.token),
    })
    expect(fromB.status).toBe(404)

    // Nor in its list
    const listB = await app.request("/v1/projects", {
      headers: authHeaders(seedB.token),
    })
    const ids = (await listB.json()).data.map((p: { id: string }) => p.id)
    expect(ids).not.toContain(aProjectId)
  })
})
