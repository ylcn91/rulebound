import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  RuleboundClient,
  RuleboundError,
  getViolations,
  isViolated,
  type AuditEntry,
  type ValidationReport,
} from "../index.js"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }
}

function textResponse(data: string, status = 200) {
  return {
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(data),
  }
}

function errorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: body }),
    text: () => Promise.resolve(body),
  }
}

describe("RuleboundClient", () => {
  let client: RuleboundClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new RuleboundClient({
      apiKey: "test-api-key",
      serverUrl: "http://localhost:3001/",
    })
  })

  it("normalizes the server URL and sends auth headers", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], total: 0 }))

    await client.listRules()

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/v1/rules",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
          "User-Agent": "rulebound-js/0.1.0",
        }),
      })
    )
  })

  it("validates code or plans", async () => {
    const report: ValidationReport = {
      task: "Validate auth flow",
      rulesMatched: 2,
      rulesTotal: 5,
      results: [],
      summary: { pass: 2, violated: 0, notCovered: 3 },
      status: "PASSED",
    }
    mockFetch.mockResolvedValue(jsonResponse(report))

    const result = await client.validate({
      plan: "Implement OAuth callback",
      project: "backend-api",
      useLlm: true,
    })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/v1/validate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          plan: "Implement OAuth callback",
          project: "backend-api",
          useLlm: true,
        }),
      })
    )
    expect(result.status).toBe("PASSED")
  })

  it("supports rules list and CRUD operations", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "rule-1",
              ruleSetId: "set-1",
              title: "No eval",
              content: "Avoid eval",
              category: "security",
              severity: "error",
              modality: "must",
              tags: ["security"],
              stack: ["typescript"],
              isActive: true,
              version: 2,
              createdAt: "2026-03-08T10:00:00Z",
              updatedAt: "2026-03-08T10:00:00Z",
            },
          ],
          total: 1,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: "rule-1",
            ruleSetId: "set-1",
            title: "No eval",
            content: "Avoid eval",
            category: "security",
            severity: "error",
            modality: "must",
            tags: ["security"],
            stack: ["typescript"],
            isActive: true,
            version: 3,
            createdAt: "2026-03-08T10:00:00Z",
            updatedAt: "2026-03-08T11:00:00Z",
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data: { deleted: true } }))

    const listed = await client.listRules({
      stack: "typescript",
      category: "security",
      tag: "security",
      q: "eval",
      limit: 10,
      offset: 5,
    })
    const updated = await client.updateRule("rule-1", {
      content: "Do not use eval",
      changeNote: "Clarify language",
    })
    const deleted = await client.deleteRule("rule-1")

    expect(mockFetch.mock.calls[0][0]).toBe(
      "http://localhost:3001/v1/rules?stack=typescript&category=security&tag=security&q=eval&limit=10&offset=5"
    )
    expect(mockFetch.mock.calls[1][0]).toBe("http://localhost:3001/v1/rules/rule-1")
    expect(mockFetch.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ content: "Do not use eval", changeNote: "Clarify language" }),
      })
    )
    expect(listed.total).toBe(1)
    expect(updated.version).toBe(3)
    expect(deleted.deleted).toBe(true)
  })

  it("supports project CRUD against the frozen contract", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ data: [], total: 0 }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: "proj-1",
            orgId: "org-1",
            name: "Rulebound",
            slug: "rulebound",
            repoUrl: "https://github.com/rulebound/rulebound",
            stack: ["typescript", "postgresql"],
            createdAt: "2026-03-08T10:00:00Z",
            updatedAt: "2026-03-08T10:00:00Z",
          },
        }, 201)
      )
      .mockResolvedValueOnce(jsonResponse({ data: { deleted: true } }))

    await client.listProjects()
    const created = await client.createProject({
      name: "Rulebound",
      slug: "rulebound",
      repoUrl: "https://github.com/rulebound/rulebound",
      stack: ["typescript", "postgresql"],
    })
    const deleted = await client.deleteProject("proj-1")

    expect(mockFetch.mock.calls[0][0]).toBe("http://localhost:3001/v1/projects")
    expect(mockFetch.mock.calls[1][0]).toBe("http://localhost:3001/v1/projects")
    expect(mockFetch.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Rulebound",
          slug: "rulebound",
          repoUrl: "https://github.com/rulebound/rulebound",
          stack: ["typescript", "postgresql"],
        }),
      })
    )
    expect(created.slug).toBe("rulebound")
    expect(deleted.deleted).toBe(true)
  })

  it("supports audit list, create, and export", async () => {
    const entry: AuditEntry = {
      id: "audit-1",
      orgId: "org-1",
      projectId: "proj-1",
      userId: "user-1",
      action: "rule.created",
      ruleId: "rule-1",
      status: "SUCCESS",
      metadata: { actor: "sdk-test" },
      createdAt: "2026-03-08T10:00:00Z",
    }
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ data: [entry], total: 1 }))
      .mockResolvedValueOnce(jsonResponse({ data: entry }, 201))
      .mockResolvedValueOnce(textResponse("id,action\n1,rule.created\n"))

    const list = await client.listAudit({
      orgId: "org-1",
      projectId: "proj-1",
      action: "rule.created",
      since: "2026-03-01T00:00:00Z",
      until: "2026-03-08T00:00:00Z",
      limit: 10,
      offset: 5,
    })
    const created = await client.createAudit({
      orgId: "org-1",
      projectId: "proj-1",
      action: "rule.created",
      status: "SUCCESS",
      metadata: { actor: "sdk-test" },
    })
    const csv = await client.exportAudit({ orgId: "org-1", limit: 20 })

    expect(mockFetch.mock.calls[0][0]).toBe(
      "http://localhost:3001/v1/audit?org_id=org-1&project_id=proj-1&action=rule.created&since=2026-03-01T00%3A00%3A00Z&until=2026-03-08T00%3A00%3A00Z&limit=10&offset=5"
    )
    expect(mockFetch.mock.calls[2][0]).toBe("http://localhost:3001/v1/audit/export?org_id=org-1&limit=20")
    expect(list.total).toBe(1)
    expect(created.id).toBe("audit-1")
    expect(csv).toContain("rule.created")
  })

  it("supports compliance and sync operations", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            projectId: "proj-1",
            currentScore: 93,
            trend: [
              {
                score: 93,
                passCount: 9,
                violatedCount: 1,
                notCoveredCount: 0,
                date: "2026-03-08T00:00:00Z",
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: "snap-1",
            projectId: "proj-1",
            score: 95,
            passCount: 10,
            violatedCount: 0,
            notCoveredCount: 0,
            snapshotAt: "2026-03-08T12:00:00Z",
          },
        }, 201)
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "rule-1",
              ruleSetId: "set-1",
              title: "No eval",
              content: "Avoid eval",
              category: "security",
              severity: "error",
              modality: "must",
              tags: ["security"],
              stack: ["typescript"],
              isActive: true,
              version: 2,
              createdAt: "2026-03-08T10:00:00Z",
              updatedAt: "2026-03-08T10:00:00Z",
            },
          ],
          meta: { total: 1, versionHash: "abc123", syncedAt: "2026-03-08T12:00:00Z" },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data: { synced: true } }))

    const compliance = await client.getCompliance("proj-1", {
      since: "2026-03-01T00:00:00Z",
      limit: 5,
    })
    const snapshot = await client.createComplianceSnapshot("proj-1", {
      score: 95,
      passCount: 10,
    })
    const sync = await client.syncRules({
      project: "rulebound",
      stack: "typescript,postgresql",
      since: "2026-03-01T00:00:00Z",
    })
    const ack = await client.ackSync({
      projectId: "proj-1",
      ruleVersionHash: "abc123",
    })

    expect(mockFetch.mock.calls[0][0]).toBe(
      "http://localhost:3001/v1/compliance/proj-1?since=2026-03-01T00%3A00%3A00Z&limit=5"
    )
    expect(mockFetch.mock.calls[2][0]).toBe(
      "http://localhost:3001/v1/sync?project=rulebound&stack=typescript%2Cpostgresql&since=2026-03-01T00%3A00%3A00Z"
    )
    expect(compliance.currentScore).toBe(93)
    expect(snapshot.score).toBe(95)
    expect(sync.meta.versionHash).toBe("abc123")
    expect(ack.synced).toBe(true)
  })

  it("supports token and analytics read endpoints", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "token-1",
              orgId: "org-1",
              userId: "user-1",
              name: "CI token",
              tokenPrefix: "rb_123456",
              scopes: ["read", "validate"],
              expiresAt: null,
              lastUsedAt: null,
              createdAt: "2026-03-08T10:00:00Z",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: "token-1",
            name: "CI token",
            token: "rb_secret",
            prefix: "rb_123456",
            scopes: ["read", "validate"],
            expiresAt: null,
            createdAt: "2026-03-08T10:00:00Z",
          },
        }, 201)
      )
      .mockResolvedValueOnce(jsonResponse({ data: [{ ruleId: "rule-1", count: 4 }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            projectId: "proj-1",
            interval: "day",
            trend: [
              {
                score: 93,
                passCount: 9,
                violatedCount: 1,
                notCoveredCount: 0,
                date: "2026-03-08T00:00:00Z",
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data: [{ action: "validation.violation", count: 7 }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ status: "VIOLATED", count: 7 }] }))

    const tokens = await client.listTokens({ orgId: "org-1" })
    const created = await client.createToken({
      orgId: "org-1",
      userId: "user-1",
      name: "CI token",
      scopes: ["read", "validate"],
    })
    const top = await client.getTopViolations({ projectId: "proj-1", since: "2026-03-01T00:00:00Z", limit: 5 })
    const trend = await client.getAnalyticsTrend("proj-1", { interval: "day", limit: 7 })
    const breakdown = await client.getCategoryBreakdown({ projectId: "proj-1" })
    const sources = await client.getSourceStats({ since: "2026-03-01T00:00:00Z" })

    expect(mockFetch.mock.calls[0][0]).toBe("http://localhost:3001/v1/tokens?org_id=org-1")
    expect(mockFetch.mock.calls[2][0]).toBe(
      "http://localhost:3001/v1/analytics/top-violations?project_id=proj-1&since=2026-03-01T00%3A00%3A00Z&limit=5"
    )
    expect(mockFetch.mock.calls[3][0]).toBe(
      "http://localhost:3001/v1/analytics/trend?project_id=proj-1&interval=day&limit=7"
    )
    expect(tokens[0].name).toBe("CI token")
    expect(created.token).toBe("rb_secret")
    expect(top[0].count).toBe(4)
    expect(trend.projectId).toBe("proj-1")
    expect(breakdown[0].action).toBe("validation.violation")
    expect(sources[0].status).toBe("VIOLATED")
  })

  it("supports webhook endpoint operations and deliveries", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "wh-1",
              orgId: "org-1",
              url: "https://hooks.example.com/rulebound",
              events: ["violation.detected"],
              isActive: true,
              description: "Production",
              secretPrefix: "whsec_ab...",
              createdAt: "2026-03-08T10:00:00Z",
              updatedAt: "2026-03-08T10:00:00Z",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: "wh-1",
            orgId: "org-1",
            url: "https://hooks.example.com/rulebound",
            events: ["violation.detected"],
            isActive: true,
            description: "Production",
            secret: "whsec_secret_secret",
            createdAt: "2026-03-08T10:00:00Z",
            updatedAt: "2026-03-08T10:00:00Z",
          },
        }, 201)
      )
      .mockResolvedValueOnce(jsonResponse({ data: { success: true, statusCode: 200 } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "delivery-1",
              endpointId: "wh-1",
              event: "test",
              status: "delivered",
              responseCode: 200,
              attempts: 1,
              createdAt: "2026-03-08T10:00:00Z",
            },
          ],
        })
      )

    const endpoints = await client.listWebhookEndpoints({ orgId: "org-1" })
    const created = await client.createWebhookEndpoint({
      orgId: "org-1",
      url: "https://hooks.example.com/rulebound",
      secret: "whsec_secret_secret",
      events: ["violation.detected"],
      description: "Production",
    })
    const test = await client.testWebhookEndpoint("wh-1")
    const deliveries = await client.listWebhookDeliveries({ endpointId: "wh-1", limit: 10 })

    expect(mockFetch.mock.calls[0][0]).toBe("http://localhost:3001/v1/webhooks/endpoints?org_id=org-1")
    expect(mockFetch.mock.calls[2][0]).toBe("http://localhost:3001/v1/webhooks/endpoints/wh-1/test")
    expect(mockFetch.mock.calls[3][0]).toBe("http://localhost:3001/v1/webhooks/deliveries?endpoint_id=wh-1&limit=10")
    expect(endpoints[0].secretPrefix).toBe("whsec_ab...")
    expect(created.secret).toBe("whsec_secret_secret")
    expect(test.success).toBe(true)
    expect(deliveries[0].status).toBe("delivered")
  })

  it("raises RuleboundError with status and body on API failures", async () => {
    mockFetch.mockResolvedValue(errorResponse(403, "Forbidden"))

    await expect(client.validate({ plan: "test" })).rejects.toThrow(RuleboundError)

    try {
      await client.validate({ plan: "test" })
      expect.fail("expected request to fail")
    } catch (error) {
      const ruleboundError = error as RuleboundError
      expect(ruleboundError.statusCode).toBe(403)
      expect(ruleboundError.body).toBe("Forbidden")
      expect(ruleboundError.message).toContain("403")
    }
  })
})

describe("helpers", () => {
  it("detects failed reports", () => {
    const report: ValidationReport = {
      task: "task",
      rulesMatched: 1,
      rulesTotal: 1,
      results: [],
      summary: { pass: 0, violated: 1, notCovered: 0 },
      status: "FAILED",
    }

    expect(isViolated(report)).toBe(true)
  })

  it("filters violations only", () => {
    const report: ValidationReport = {
      task: "task",
      rulesMatched: 2,
      rulesTotal: 2,
      results: [
        {
          ruleId: "rule-1",
          ruleTitle: "Rule 1",
          severity: "error",
          modality: "must",
          status: "VIOLATED",
          reason: "bad",
        },
        {
          ruleId: "rule-2",
          ruleTitle: "Rule 2",
          severity: "warning",
          modality: "should",
          status: "PASS",
          reason: "good",
        },
      ],
      summary: { pass: 1, violated: 1, notCovered: 0 },
      status: "FAILED",
    }

    expect(getViolations(report)).toHaveLength(1)
    expect(getViolations(report)[0].ruleId).toBe("rule-1")
  })
})
