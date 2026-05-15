import { describe, it, expect } from "vitest"
import { authHeaders, buildApp, seedOrgAndToken } from "./helpers.js"

describe("integration: /v1/rules", () => {
  it("creates, lists, updates, and deletes rules", async () => {
    const seed = await seedOrgAndToken()
    const app = buildApp()

    const create = await app.request("/v1/rules", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({
        title: "No secrets",
        content: "- Must not commit secrets",
        category: "security",
        severity: "error",
        modality: "must",
      }),
    })
    expect(create.status).toBe(201)
    const created = await create.json()
    expect(created.data.title).toBe("No secrets")
    const ruleId = created.data.id

    const list = await app.request("/v1/rules", {
      headers: authHeaders(seed.token),
    })
    expect(list.status).toBe(200)
    const listBody = await list.json()
    expect(listBody.data.some((r: { id: string }) => r.id === ruleId)).toBe(true)

    const update = await app.request(`/v1/rules/${ruleId}`, {
      method: "PUT",
      headers: authHeaders(seed.token),
      body: JSON.stringify({
        title: "No hardcoded secrets",
        changeNote: "more precise",
      }),
    })
    expect(update.status).toBe(200)
    const updated = await update.json()
    expect(updated.data.title).toBe("No hardcoded secrets")
    expect(updated.data.version).toBe(2)

    const del = await app.request(`/v1/rules/${ruleId}`, {
      method: "DELETE",
      headers: authHeaders(seed.token),
    })
    expect(del.status).toBe(200)

    const getAfter = await app.request(`/v1/rules/${ruleId}`, {
      headers: authHeaders(seed.token),
    })
    expect(getAfter.status).toBe(404)
  })

  it("isolates rules by org", async () => {
    const seedA = await seedOrgAndToken()
    const seedB = await seedOrgAndToken()
    const app = buildApp()

    const createA = await app.request("/v1/rules", {
      method: "POST",
      headers: authHeaders(seedA.token),
      body: JSON.stringify({
        title: "Org A Rule",
        content: "- rule body",
        category: "style",
      }),
    })
    const ruleId = (await createA.json()).data.id

    const getFromB = await app.request(`/v1/rules/${ruleId}`, {
      headers: authHeaders(seedB.token),
    })
    expect(getFromB.status).toBe(404)
  })

  it("rejects writes when scope is missing", async () => {
    const seed = await seedOrgAndToken({
      scopes: ["rules:read", "validate:run"],
    })
    const app = buildApp()
    const res = await app.request("/v1/rules", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({
        title: "x",
        content: "y",
        category: "style",
      }),
    })
    expect(res.status).toBe(403)
  })
})
