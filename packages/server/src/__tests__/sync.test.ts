import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
  schema: {
    rules: { isActive: "is_active" },
    ruleSyncState: { projectId: "project_id", id: "id" },
  },
}))

import { getDb } from "../db/index.js"

const mockGetDb = vi.mocked(getDb)

async function createApp() {
  const { syncApi } = await import("../api/sync.js")
  const app = new Hono()
  app.route("/sync", syncApi)
  return app
}

function makeDbRule(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    title: "Test Rule",
    content: "Test content",
    category: "security",
    severity: "error",
    modality: "must",
    tags: ["test"],
    stack: [],
    isActive: true,
    version: 1,
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  }
}

describe("sync API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET /", () => {
    it("returns rules with version hash", async () => {
      const dbRules = [makeDbRule()]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(dbRules),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/sync")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe("rule-1")
      expect(body.meta.total).toBe(1)
      expect(body.meta.versionHash).toBeDefined()
      expect(body.meta.syncedAt).toBeDefined()
    })

    it("filters by stack query parameter", async () => {
      // DB mock returns what the SQL WHERE would return (already filtered)
      const filteredRules = [
        makeDbRule({ id: "java-rule", stack: ["java"] }),
        makeDbRule({ id: "global-rule", stack: [] }),
      ]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(filteredRules),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/sync?stack=java")

      expect(res.status).toBe(200)
      const body = await res.json()
      const ids = body.data.map((r: { id: string }) => r.id)
      expect(ids).toContain("java-rule")
      expect(ids).toContain("global-rule")
      expect(body.meta.total).toBe(2)
    })

    it("filters by since query parameter", async () => {
      // DB mock returns what the SQL WHERE would return (already filtered)
      const filteredRules = [
        makeDbRule({ id: "new-rule", updatedAt: new Date("2025-06-01") }),
      ]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(filteredRules),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/sync?since=2025-01-01")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe("new-rule")
    })

    it("returns empty data when no rules exist", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/sync")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(0)
      expect(body.meta.total).toBe(0)
    })

    it("computes consistent hash for same rules", async () => {
      const dbRules = [
        makeDbRule({ id: "rule-a", content: "content a", version: 1 }),
        makeDbRule({ id: "rule-b", content: "content b", version: 2 }),
      ]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(dbRules),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res1 = await app.request("/sync")
      const body1 = await res1.json()

      mockGetDb.mockReturnValue(mockDb as never)
      const res2 = await app.request("/sync")
      const body2 = await res2.json()

      expect(body1.meta.versionHash).toBe(body2.meta.versionHash)
    })
  })

  describe("POST /ack", () => {
    it("returns 400 when missing required fields", async () => {
      const app = await createApp()
      const res = await app.request("/sync/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe("Validation failed")
    })

    it("creates sync state for new project", async () => {
      const mockInsertValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "sync-1" }]),
      })
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: mockInsertValues,
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/sync/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "proj-1",
          ruleVersionHash: "abc123",
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.synced).toBe(true)
    })

    it("updates existing sync state", async () => {
      const mockSetWhere = vi.fn().mockResolvedValue([])
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "existing-sync", projectId: "proj-1" }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: mockSetWhere,
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/sync/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "proj-1",
          ruleVersionHash: "newHash",
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.synced).toBe(true)
    })
  })
})
