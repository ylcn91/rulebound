import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { eq, desc, and, gte, sql, count as drizzleCount } from "drizzle-orm"

const app = new Hono()

app.get("/top-violations", async (c) => {
  const db = getDb()
  const projectId = c.req.query("project_id")
  const since = c.req.query("since")
  const limit = parseInt(c.req.query("limit") ?? "10", 10)

  const conditions = [eq(schema.auditLog.status, "VIOLATED")]
  if (projectId) conditions.push(eq(schema.auditLog.projectId, projectId))
  if (since) conditions.push(gte(schema.auditLog.createdAt, new Date(since)))

  const result = await db
    .select({
      ruleId: schema.auditLog.ruleId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.auditLog)
    .where(and(...conditions))
    .groupBy(schema.auditLog.ruleId)
    .orderBy(sql`count(*) desc`)
    .limit(limit)

  return c.json({ data: result })
})

app.get("/trend", async (c) => {
  const db = getDb()
  const projectId = c.req.query("project_id")
  const interval = c.req.query("interval") ?? "day"
  const limit = parseInt(c.req.query("limit") ?? "30", 10)

  if (!projectId) {
    return c.json({ error: "project_id is required" }, 400)
  }

  const snapshots = await db
    .select()
    .from(schema.complianceSnapshots)
    .where(eq(schema.complianceSnapshots.projectId, projectId))
    .orderBy(desc(schema.complianceSnapshots.snapshotAt))
    .limit(limit)

  return c.json({
    data: {
      projectId,
      interval,
      trend: snapshots.map((s) => ({
        score: s.score,
        passCount: s.passCount,
        violatedCount: s.violatedCount,
        notCoveredCount: s.notCoveredCount,
        date: s.snapshotAt,
      })),
    },
  })
})

app.get("/category-breakdown", async (c) => {
  const db = getDb()
  const projectId = c.req.query("project_id")
  const since = c.req.query("since")

  const conditions = [eq(schema.auditLog.status, "VIOLATED")]
  if (projectId) conditions.push(eq(schema.auditLog.projectId, projectId))
  if (since) conditions.push(gte(schema.auditLog.createdAt, new Date(since)))

  const result = await db
    .select({
      action: schema.auditLog.action,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.auditLog)
    .where(and(...conditions))
    .groupBy(schema.auditLog.action)
    .orderBy(sql`count(*) desc`)

  return c.json({ data: result })
})

app.get("/source-stats", async (c) => {
  const db = getDb()
  const projectId = c.req.query("project_id")
  const since = c.req.query("since")

  const conditions = []
  if (projectId) conditions.push(eq(schema.auditLog.projectId, projectId))
  if (since) conditions.push(gte(schema.auditLog.createdAt, new Date(since)))

  const where = conditions.length > 0
    ? conditions.length === 1 ? conditions[0] : and(...conditions)
    : undefined

  const result = await db
    .select({
      status: schema.auditLog.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.auditLog)
    .where(where)
    .groupBy(schema.auditLog.status)
    .orderBy(sql`count(*) desc`)

  return c.json({ data: result })
})

app.post("/events", async (c) => {
  const db = getDb()
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const events = Array.isArray(raw.events) ? raw.events : [raw]

  const entries = events.map((event: Record<string, unknown>) => ({
    orgId: String(event.orgId ?? ""),
    projectId: event.projectId ? String(event.projectId) : undefined,
    userId: event.userId ? String(event.userId) : undefined,
    action: String(event.source ?? "cli"),
    ruleId: undefined,
    status: String(event.violated && (event.violated as string[]).length > 0 ? "VIOLATED" : "PASSED"),
    metadata: event,
  }))

  if (entries.length > 0 && entries[0].orgId) {
    for (const entry of entries) {
      await db.insert(schema.auditLog).values(entry)
    }
  }

  return c.json({ data: { synced: entries.length } }, 201)
})

export { app as analyticsApi }
