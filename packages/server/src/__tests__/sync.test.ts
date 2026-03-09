import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
  schema: {
    ruleSyncState: { projectId: "project_id", id: "id" },
  },
}))

vi.mock("../lib/projects.js", () => ({
  resolveProjectForOrg: vi.fn(),
}))

vi.mock("../lib/rules.js", () => ({
  getEffectiveRuleSetIds: vi.fn(),
  resolveRulesForRuleSetIds: vi.fn(),
}))

vi.mock("../lib/activity.js", () => ({
  writeAuditEntry: vi.fn(),
  emitWebhookEvent: vi.fn(),
}))

import { getDb } from "../db/index.js"
import { resolveProjectForOrg } from "../lib/projects.js"
import { getEffectiveRuleSetIds, resolveRulesForRuleSetIds } from "../lib/rules.js"
import { writeAuditEntry, emitWebhookEvent } from "../lib/activity.js"

const mockGetDb = vi.mocked(getDb)
const mockResolveProjectForOrg = vi.mocked(resolveProjectForOrg)
const mockGetEffectiveRuleSetIds = vi.mocked(getEffectiveRuleSetIds)
const mockResolveRulesForRuleSetIds = vi.mocked(resolveRulesForRuleSetIds)
const mockWriteAuditEntry = vi.mocked(writeAuditEntry)
const mockEmitWebhookEvent = vi.mocked(emitWebhookEvent)

async function createApp() {
  const { syncApi } = await import("../api/sync.js")
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("orgId" as never, "org-1" as never)
    c.set("userId" as never, "user-1" as never)
    c.set("tokenScopes" as never, [] as never)
    await next()
  })
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
    vi.resetModules()
    mockResolveProjectForOrg.mockResolvedValue({
      id: "proj-1",
      orgId: "org-1",
      name: "Project",
      slug: "project",
      repoUrl: null,
      stack: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    mockGetEffectiveRuleSetIds.mockResolvedValue(["rs-1"])
    mockResolveRulesForRuleSetIds.mockResolvedValue([] as never)
    mockWriteAuditEntry.mockResolvedValue(undefined)
    mockEmitWebhookEvent.mockResolvedValue(undefined)
  })

  describe("GET /", () => {
    it("returns rules with version hash", async () => {
      const dbRules = [makeDbRule()]
      mockGetDb.mockReturnValue({} as never)
      mockResolveRulesForRuleSetIds.mockResolvedValue(dbRules as never)

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
      const filteredRules = [
        makeDbRule({ id: "java-rule", stack: ["java"] }),
        makeDbRule({ id: "global-rule", stack: [] }),
      ]
      mockGetDb.mockReturnValue({} as never)
      mockResolveRulesForRuleSetIds.mockResolvedValue(filteredRules as never)

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
      const filteredRules = [
        makeDbRule({ id: "new-rule", updatedAt: new Date("2025-06-01") }),
      ]
      mockGetDb.mockReturnValue({} as never)
      mockResolveRulesForRuleSetIds.mockResolvedValue(filteredRules as never)

      const app = await createApp()
      const res = await app.request("/sync?since=2025-01-01")

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe("new-rule")
    })

    it("returns empty data when no rules exist", async () => {
      mockGetDb.mockReturnValue({} as never)
      mockResolveRulesForRuleSetIds.mockResolvedValue([] as never)

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
      mockGetDb.mockReturnValue({} as never)
      mockResolveRulesForRuleSetIds.mockResolvedValue(dbRules as never)

      const app = await createApp()
      const res1 = await app.request("/sync")
      const body1 = await res1.json()

      mockGetDb.mockReturnValue({} as never)
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
