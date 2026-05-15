import { describe, it, expect } from "vitest"
import { authHeaders, buildApp, seedOrgAndToken } from "./helpers.js"
import { getDb, schema } from "../../db/index.js"
import { pruneAuditEntries } from "../../lib/audit.js"
import { and, eq } from "drizzle-orm"

describe("integration: /v1/audit", () => {
  it("returns redacted metadata in list responses", async () => {
    const seed = await seedOrgAndToken()
    const db = getDb()
    await db.insert(schema.auditLog).values({
      orgId: seed.orgId,
      userId: seed.userId,
      action: "test.event",
      status: "success",
      metadata: { token: "leak-me", note: "keep" },
    })

    const app = buildApp()
    const res = await app.request("/v1/audit", {
      headers: authHeaders(seed.token),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBeGreaterThan(0)
    const found = body.data.find(
      (entry: { metadata?: Record<string, unknown> | null }) =>
        entry.metadata && (entry.metadata as Record<string, unknown>).note === "keep",
    )
    expect(found).toBeTruthy()
    expect(found.metadata.token).toBe("[REDACTED]")
  })

  it("isolates audit entries by org", async () => {
    const seedA = await seedOrgAndToken()
    const seedB = await seedOrgAndToken()
    const db = getDb()

    await db.insert(schema.auditLog).values({
      orgId: seedA.orgId,
      userId: seedA.userId,
      action: "org-a-only-event",
      status: "success",
      metadata: { kind: "a" },
    })

    const app = buildApp()
    const res = await app.request("/v1/audit", {
      headers: authHeaders(seedB.token),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const actions = body.data.map(
      (entry: { action: string }) => entry.action,
    )
    expect(actions).not.toContain("org-a-only-event")
  })

  it("pruneAuditEntries deletes rows older than the cutoff and leaves recent ones intact", async () => {
    const seed = await seedOrgAndToken()
    const db = getDb()

    // Old row (200d ago)
    const oldCreatedAt = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000)
    const [oldRow] = await db
      .insert(schema.auditLog)
      .values({
        orgId: seed.orgId,
        userId: seed.userId,
        action: "ancient.event",
        status: "success",
        createdAt: oldCreatedAt,
      })
      .returning()

    // Recent row
    const [recentRow] = await db
      .insert(schema.auditLog)
      .values({
        orgId: seed.orgId,
        userId: seed.userId,
        action: "recent.event",
        status: "success",
      })
      .returning()

    const result = await pruneAuditEntries(db, { retentionDays: 90 })
    expect(result.skipped).toBe(false)
    expect(result.deleted).toBeGreaterThanOrEqual(1)

    const [stillThere] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.orgId, seed.orgId),
          eq(schema.auditLog.id, recentRow.id),
        ),
      )
    expect(stillThere).toBeTruthy()

    const oldGone = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.id, oldRow.id))
    expect(oldGone).toHaveLength(0)
  })
})
