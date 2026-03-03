import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
  schema: {
    complianceSnapshots: {
      projectId: "project_id",
      snapshotAt: "snapshot_at",
    },
  },
}))

import { getDb } from "../db/index.js"

const mockGetDb = vi.mocked(getDb)

async function createApp() {
  const { complianceApi } = await import("../api/compliance.js")
  const app = new Hono()
  app.route("/compliance", complianceApi)
  return app
}

describe("compliance API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET /:projectId", () => {
    it("returns compliance data with current score and trend", async () => {
      const snapshots = [
        { id: "s-1", projectId: "proj-1", score: 85, passCount: 8, violatedCount: 1, notCoveredCount: 1, snapshotAt: new Date("2025-06-01") },
        { id: "s-2", projectId: "proj-1", score: 80, passCount: 7, violatedCount: 2, notCoveredCount: 1, snapshotAt: new Date("2025-05-01") },
      ]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(snapshots),
              }),
            }),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/compliance/proj-1")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.projectId).toBe("proj-1")
      expect(body.data.currentScore).toBe(85)
      expect(body.data.trend).toHaveLength(2)
      expect(body.data.trend[0].score).toBe(85)
      expect(body.data.trend[0].passCount).toBe(8)
    })

    it("returns null score when no snapshots exist", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/compliance/proj-1")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.projectId).toBe("proj-1")
      expect(body.data.currentScore).toBeNull()
      expect(body.data.trend).toHaveLength(0)
    })

    it("filters snapshots by since parameter", async () => {
      const snapshots = [
        { id: "s-1", projectId: "proj-1", score: 90, passCount: 9, violatedCount: 0, notCoveredCount: 1, snapshotAt: new Date("2025-06-01") },
      ]
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(snapshots),
              }),
            }),
          }),
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/compliance/proj-1?since=2025-05-01")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.trend).toHaveLength(1)
    })
  })

  describe("POST /:projectId/snapshot", () => {
    it("creates a compliance snapshot", async () => {
      const created = {
        id: "snap-new",
        projectId: "proj-1",
        score: 92,
        passCount: 9,
        violatedCount: 0,
        notCoveredCount: 1,
        snapshotAt: new Date(),
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
      const res = await app.request("/compliance/proj-1/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: 92,
          passCount: 9,
          violatedCount: 0,
          notCoveredCount: 1,
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.score).toBe(92)
    })

    it("returns 400 when score is missing", async () => {
      const app = await createApp()
      const res = await app.request("/compliance/proj-1/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passCount: 5 }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe("Validation failed")
    })

    it("defaults missing counts to zero", async () => {
      const mockInsertValues = vi.fn()
      mockInsertValues.mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "snap-new",
          projectId: "proj-1",
          score: 100,
          passCount: 0,
          violatedCount: 0,
          notCoveredCount: 0,
          snapshotAt: new Date(),
        }]),
      })
      const mockDb = {
        insert: vi.fn().mockReturnValue({
          values: mockInsertValues,
        }),
      }
      mockGetDb.mockReturnValue(mockDb as never)

      const app = await createApp()
      const res = await app.request("/compliance/proj-1/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: 100 }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.passCount).toBe(0)
      expect(body.data.violatedCount).toBe(0)
      expect(body.data.notCoveredCount).toBe(0)
    })
  })
})
