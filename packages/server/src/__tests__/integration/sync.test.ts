import { describe, it, expect } from "vitest"
import { authHeaders, buildApp, seedOrgAndToken } from "./helpers.js"

describe("integration: /v1/sync", () => {
  it("returns rules and accepts ack updates against a real DB", async () => {
    const seed = await seedOrgAndToken()
    const app = buildApp()

    // Seed a project so /sync/ack has somewhere to record state.
    const project = await app.request("/v1/projects", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({ name: "SyncP", slug: "sync-project" }),
    })
    expect(project.status).toBe(201)
    const projectId = (await project.json()).data.id

    // Seed a rule for variety.
    await app.request("/v1/rules", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({
        title: "Sync Rule",
        content: "- be good",
        category: "style",
      }),
    })

    const sync = await app.request("/v1/sync", {
      headers: authHeaders(seed.token),
    })
    expect(sync.status).toBe(200)
    const syncBody = await sync.json()
    expect(syncBody.meta.versionHash).toMatch(/[a-f0-9]+/)

    const ack = await app.request("/v1/sync/ack", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({
        projectId,
        ruleVersionHash: syncBody.meta.versionHash,
      }),
    })
    expect(ack.status).toBe(200)

    // Second ack should still succeed (upserts existing state).
    const ack2 = await app.request("/v1/sync/ack", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({
        projectId,
        ruleVersionHash: syncBody.meta.versionHash,
      }),
    })
    expect(ack2.status).toBe(200)
  })

  it("403s when token is missing sync:write scope", async () => {
    const seed = await seedOrgAndToken({
      scopes: ["rules:read", "projects:write"],
    })
    const app = buildApp()

    const project = await app.request("/v1/projects", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({ name: "No Sync", slug: "no-sync" }),
    })
    const projectId = (await project.json()).data.id

    const res = await app.request("/v1/sync/ack", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({ projectId, ruleVersionHash: "deadbeef" }),
    })
    expect(res.status).toBe(403)
  })
})
