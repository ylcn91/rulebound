import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
  schema: {
    auditLog: {
      orgId: "org_id",
      projectId: "project_id",
      action: "action",
      createdAt: "created_at",
    },
  },
}))

import { getDb } from "../db/index.js"

const mockGetDb = vi.mocked(getDb)

async function createApp() {
  const { auditApi } = await import("../api/audit.js")
  const app = new Hono()
  app.route("/audit", auditApi)
  return app
}

describe("audit API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET /", () => {
    it("returns audit log entries", async () => {
      const entries = [
        { id: "a-1", orgId: "org-1", action: "validation.violation", status: "VIOLATED", createdAt: new Date() },
      ]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(entries),
                }),
              }),
            }),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/audit?org_id=org-1")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.total).toBe(1)
    })

    it("returns empty results when no entries match", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/audit")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(0)
      expect(body.total).toBe(0)
    })

    it("applies query filters for action and date range", async () => {
      const entries = [
        { id: "a-1", orgId: "org-1", action: "validation.violation", status: "VIOLATED", createdAt: new Date() },
      ]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue(entries),
                }),
              }),
            }),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/audit?action=validation.violation&since=2025-01-01&until=2025-12-31")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })

    it("respects limit and offset parameters", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/audit?limit=10&offset=5")

      expect(res.status).toBe(200)
    })
  })

  describe("POST /", () => {
    it("creates an audit log entry", async () => {
      const created = {
        id: "a-new",
        orgId: "org-1",
        action: "rule.created",
        status: "success",
        createdAt: new Date(),
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
      const res = await app.request("/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: "org-1",
          action: "rule.created",
          status: "success",
          metadata: { note: "New rule added" },
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.orgId).toBe("org-1")
    })

    it("returns 400 when missing required fields", async () => {
      const app = await createApp()
      const res = await app.request("/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: "org-1" }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain("Missing")
    })

    it("returns 400 when action is missing", async () => {
      const app = await createApp()
      const res = await app.request("/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: "org-1", status: "ok" }),
      })

      expect(res.status).toBe(400)
    })

    it("returns 400 when status is missing", async () => {
      const app = await createApp()
      const res = await app.request("/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: "org-1", action: "test" }),
      })

      expect(res.status).toBe(400)
    })
  })
})
