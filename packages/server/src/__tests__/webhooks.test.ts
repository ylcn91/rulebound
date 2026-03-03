import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
  schema: {
    webhookEndpoints: { orgId: "org_id", id: "id" },
    webhookDeliveries: { endpointId: "endpoint_id" },
    webhookSources: { provider: "provider" },
  },
}))

vi.mock("../webhooks/dispatcher.js", () => ({
  deliverWebhook: vi.fn(),
}))

vi.mock("../webhooks/receivers.js", () => ({
  verifyGitHubSignature: vi.fn(),
  parseGitHubEvent: vi.fn(),
}))

import { getDb } from "../db/index.js"
import { deliverWebhook } from "../webhooks/dispatcher.js"
import { verifyGitHubSignature, parseGitHubEvent } from "../webhooks/receivers.js"

const mockGetDb = vi.mocked(getDb)
const mockDeliverWebhook = vi.mocked(deliverWebhook)
const mockVerifyGitHub = vi.mocked(verifyGitHubSignature)
const mockParseGitHub = vi.mocked(parseGitHubEvent)

async function createApp() {
  const { webhooksApi } = await import("../api/webhooks.js")
  const app = new Hono()
  app.route("/webhooks", webhooksApi)
  return app
}

describe("webhooks API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET /endpoints", () => {
    it("returns all endpoints without secrets", async () => {
      const endpoints = [
        { id: "ep-1", orgId: "org-1", url: "https://example.com", secret: "s3cret", events: ["violation.detected"], isActive: true },
      ]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(endpoints),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/webhooks/endpoints?org_id=org-1")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0]).not.toHaveProperty("secret")
      expect(body.data[0].url).toBe("https://example.com")
    })

    it("returns all endpoints when no org_id filter", async () => {
      const endpoints = [
        { id: "ep-1", orgId: "org-1", url: "https://a.com", secret: "s1", events: [] },
        { id: "ep-2", orgId: "org-2", url: "https://b.com", secret: "s2", events: [] },
      ]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue(Promise.resolve(endpoints)),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/webhooks/endpoints")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })
  })

  describe("POST /endpoints", () => {
    it("creates an endpoint and returns without secret", async () => {
      const created = {
        id: "ep-new",
        orgId: "org-1",
        url: "https://hook.example.com",
        secret: "hidden",
        events: ["violation.detected"],
        description: "Test hook",
      }
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([created]),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/webhooks/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: "org-1",
          url: "https://hook.example.com",
          secret: "hidden",
          events: ["violation.detected"],
          description: "Test hook",
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).not.toHaveProperty("secret")
      expect(body.data.url).toBe("https://hook.example.com")
    })

    it("returns 400 when missing required fields", async () => {
      const app = await createApp()
      const res = await app.request("/webhooks/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: "org-1" }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain("Missing")
    })
  })

  describe("DELETE /endpoints/:id", () => {
    it("deletes an endpoint and returns success", async () => {
      const mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "ep-1" }]),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/webhooks/endpoints/ep-1", {
        method: "DELETE",
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.deleted).toBe(true)
    })

    it("returns 404 when endpoint not found", async () => {
      const mockDb = {
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/webhooks/endpoints/nonexistent", {
        method: "DELETE",
      })

      expect(res.status).toBe(404)
    })
  })

  describe("POST /endpoints/:id/test", () => {
    it("sends test webhook and records delivery", async () => {
      const endpoint = {
        id: "ep-1",
        url: "https://hook.example.com",
        secret: "test-secret",
        events: ["violation.detected"],
      }
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      })
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([endpoint]),
          }),
        }),
        insert: mockInsert,
      }
      mockGetDb.mockReturnValue(mockDb as never)
      mockDeliverWebhook.mockResolvedValue({ success: true, statusCode: 200 })

      const app = await createApp()
      const res = await app.request("/webhooks/endpoints/ep-1/test", {
        method: "POST",
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.success).toBe(true)
      expect(mockDeliverWebhook).toHaveBeenCalledWith(
        "https://hook.example.com",
        expect.objectContaining({ event: "violation.detected" }),
        "test-secret"
      )
    })

    it("returns 404 when endpoint not found for test", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/webhooks/endpoints/nonexistent/test", {
        method: "POST",
      })

      expect(res.status).toBe(404)
    })
  })

  describe("GET /deliveries", () => {
    it("returns deliveries for an endpoint", async () => {
      const deliveries = [
        { id: "del-1", endpointId: "ep-1", event: "violation.detected", status: "delivered" },
      ]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(deliveries),
            }),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/webhooks/deliveries?endpoint_id=ep-1")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })
  })

  describe("POST /in (inbound webhooks)", () => {
    it("accepts generic webhook", async () => {
      const app = await createApp()
      const res = await app.request("/webhooks/in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.received).toBe(true)
    })

    it("verifies GitHub webhook signature", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "src-1", provider: "github", secret: "gh-secret" },
            ]),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)
      mockVerifyGitHub.mockReturnValue(true)
      mockParseGitHub.mockReturnValue({ type: "push", data: {} } as never)

      const app = await createApp()
      const res = await app.request("/webhooks/in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitHub-Event": "push",
          "X-Hub-Signature-256": "sha256=abc123",
        },
        body: JSON.stringify({ ref: "refs/heads/main" }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.received).toBe(true)
    })

    it("rejects invalid GitHub signature", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "src-1", provider: "github", secret: "gh-secret" },
            ]),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)
      mockVerifyGitHub.mockReturnValue(false)

      const app = await createApp()
      const res = await app.request("/webhooks/in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitHub-Event": "push",
          "X-Hub-Signature-256": "sha256=invalid",
        },
        body: JSON.stringify({ ref: "refs/heads/main" }),
      })

      expect(res.status).toBe(401)
    })
  })
})
