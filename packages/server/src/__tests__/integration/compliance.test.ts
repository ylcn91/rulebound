import { describe, it, expect } from "vitest"
import { authHeaders, buildApp, seedOrgAndToken } from "./helpers.js"

describe("integration: /v1/compliance", () => {
  it("creates and reads compliance snapshots", async () => {
    const seed = await seedOrgAndToken()
    const app = buildApp()

    const project = await app.request("/v1/projects", {
      method: "POST",
      headers: authHeaders(seed.token),
      body: JSON.stringify({ name: "Comp", slug: "compliance-project" }),
    })
    expect(project.status).toBe(201)
    const projectId = (await project.json()).data.id

    const snap = await app.request(
      `/v1/compliance/${projectId}/snapshot`,
      {
        method: "POST",
        headers: authHeaders(seed.token),
        body: JSON.stringify({
          score: 92,
          passCount: 30,
          violatedCount: 2,
          notCoveredCount: 0,
        }),
      },
    )
    expect(snap.status).toBe(201)

    const read = await app.request(`/v1/compliance/${projectId}`, {
      headers: authHeaders(seed.token),
    })
    expect(read.status).toBe(200)
    const body = await read.json()
    expect(body.data.currentScore).toBe(92)
    expect(body.data.trend.length).toBeGreaterThan(0)
  })

  it("rejects compliance read for another org's project", async () => {
    const seedA = await seedOrgAndToken()
    const seedB = await seedOrgAndToken()
    const app = buildApp()

    const project = await app.request("/v1/projects", {
      method: "POST",
      headers: authHeaders(seedA.token),
      body: JSON.stringify({ name: "Org A Only", slug: "comp-org-a" }),
    })
    const projectId = (await project.json()).data.id

    const res = await app.request(`/v1/compliance/${projectId}`, {
      headers: authHeaders(seedB.token),
    })
    expect(res.status).toBe(404)
  })
})
