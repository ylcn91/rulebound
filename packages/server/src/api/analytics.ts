import { Hono } from "hono"
import { and, eq, gte, sql } from "drizzle-orm"
import { getDb, schema } from "../db/index.js"
import { requireRequestIdentity } from "../lib/request-context.js"
import { resolveProjectForOrg } from "../lib/projects.js"

const app = new Hono()

app.get("/top-violations", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const projectIdentifier = c.req.query("project_id")
  const since = c.req.query("since")
  const limit = parseInt(c.req.query("limit") ?? "10", 10)

  const conditions = [eq(schema.auditLog.orgId, identity.orgId), eq(schema.auditLog.status, "VIOLATED")]

  if (projectIdentifier) {
    const project = await resolveProjectForOrg(db, identity.orgId, projectIdentifier)
    if (!project) return c.json({ error: "Project not found" }, 404)
    conditions.push(eq(schema.auditLog.projectId, project.id))
  }

  if (since) {
    conditions.push(gte(schema.auditLog.createdAt, new Date(since)))
  }

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
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const projectIdentifier = c.req.query("project_id")
  const interval = c.req.query("interval") ?? "day"
  const limit = parseInt(c.req.query("limit") ?? "30", 10)

  if (!projectIdentifier) return c.json({ error: "project_id is required" }, 400)

  const project = await resolveProjectForOrg(db, identity.orgId, projectIdentifier)
  if (!project) return c.json({ error: "Project not found" }, 404)

  const snapshots = await db
    .select()
    .from(schema.complianceSnapshots)
    .where(eq(schema.complianceSnapshots.projectId, project.id))
    .orderBy(sql`${schema.complianceSnapshots.snapshotAt} desc`)
    .limit(limit)

  return c.json({
    data: {
      projectId: project.id,
      interval,
      trend: snapshots.map((snapshot) => ({
        score: snapshot.score,
        passCount: snapshot.passCount,
        violatedCount: snapshot.violatedCount,
        notCoveredCount: snapshot.notCoveredCount,
        date: snapshot.snapshotAt,
      })),
    },
  })
})

app.get("/category-breakdown", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const projectIdentifier = c.req.query("project_id")
  const since = c.req.query("since")

  const conditions = [eq(schema.auditLog.orgId, identity.orgId), eq(schema.auditLog.status, "VIOLATED")]

  if (projectIdentifier) {
    const project = await resolveProjectForOrg(db, identity.orgId, projectIdentifier)
    if (!project) return c.json({ error: "Project not found" }, 404)
    conditions.push(eq(schema.auditLog.projectId, project.id))
  }

  if (since) {
    conditions.push(gte(schema.auditLog.createdAt, new Date(since)))
  }

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
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const projectIdentifier = c.req.query("project_id")
  const since = c.req.query("since")

  const conditions = [eq(schema.auditLog.orgId, identity.orgId)]

  if (projectIdentifier) {
    const project = await resolveProjectForOrg(db, identity.orgId, projectIdentifier)
    if (!project) return c.json({ error: "Project not found" }, 404)
    conditions.push(eq(schema.auditLog.projectId, project.id))
  }

  if (since) {
    conditions.push(gte(schema.auditLog.createdAt, new Date(since)))
  }

  const result = await db
    .select({
      status: schema.auditLog.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.auditLog)
    .where(and(...conditions))
    .groupBy(schema.auditLog.status)
    .orderBy(sql`count(*) desc`)

  return c.json({ data: result })
})

app.post("/events", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const events = Array.isArray((raw as { events?: unknown[] }).events)
    ? ((raw as { events: Record<string, unknown>[] }).events)
    : [raw as Record<string, unknown>]

  for (const event of events) {
    let projectId: string | undefined
    if (typeof event.projectId === "string") {
      const project = await resolveProjectForOrg(db, identity.orgId, event.projectId)
      if (!project) {
        return c.json({ error: "Project not found" }, 404)
      }
      projectId = project.id
    }

    await db.insert(schema.auditLog).values({
      orgId: identity.orgId,
      projectId,
      userId: identity.userId,
      action: String(event.source ?? "cli"),
      status: Array.isArray(event.violated) && event.violated.length > 0 ? "VIOLATED" : "PASSED",
      metadata: event,
    })
  }

  return c.json({ data: { synced: events.length } }, 201)
})

export { app as analyticsApi }
