import { Hono } from "hono"
import { and, desc, eq, gte } from "drizzle-orm"
import { getDb, schema } from "../db/index.js"
import { complianceSnapshotSchema } from "../schemas.js"
import { requireRequestIdentity } from "../lib/request-context.js"
import { resolveProjectForOrg } from "../lib/projects.js"
import { emitWebhookEvent, writeAuditEntry } from "../lib/activity.js"

const app = new Hono()

app.get("/:projectId", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const project = await resolveProjectForOrg(db, identity.orgId, c.req.param("projectId"))
  if (!project) {
    return c.json({ error: "Project not found" }, 404)
  }

  const conditions = [eq(schema.complianceSnapshots.projectId, project.id)]
  const since = c.req.query("since")
  if (since) {
    conditions.push(gte(schema.complianceSnapshots.snapshotAt, new Date(since)))
  }

  const limit = parseInt(c.req.query("limit") ?? "30", 10)
  const snapshots = await db
    .select()
    .from(schema.complianceSnapshots)
    .where(and(...conditions))
    .orderBy(desc(schema.complianceSnapshots.snapshotAt))
    .limit(limit)

  const latest = snapshots[0]

  return c.json({
    data: {
      projectId: project.id,
      currentScore: latest?.score ?? null,
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

app.post("/:projectId/snapshot", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const project = await resolveProjectForOrg(db, identity.orgId, c.req.param("projectId"))
  if (!project) {
    return c.json({ error: "Project not found" }, 404)
  }

  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = complianceSnapshotSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const [previous] = await db
    .select()
    .from(schema.complianceSnapshots)
    .where(eq(schema.complianceSnapshots.projectId, project.id))
    .orderBy(desc(schema.complianceSnapshots.snapshotAt))
    .limit(1)

  const [snapshot] = await db
    .insert(schema.complianceSnapshots)
    .values({
      projectId: project.id,
      score: parsed.data.score,
      passCount: parsed.data.passCount ?? 0,
      violatedCount: parsed.data.violatedCount ?? 0,
      notCoveredCount: parsed.data.notCoveredCount ?? 0,
    })
    .returning()

  await writeAuditEntry(db, {
    orgId: identity.orgId,
    projectId: project.id,
    userId: identity.userId,
    action: "compliance.snapshot.created",
    status: "success",
    metadata: {
      score: snapshot.score,
      passCount: snapshot.passCount,
      violatedCount: snapshot.violatedCount,
      notCoveredCount: snapshot.notCoveredCount,
    },
  })

  if (previous && previous.score !== snapshot.score) {
    await writeAuditEntry(db, {
      orgId: identity.orgId,
      projectId: project.id,
      userId: identity.userId,
      action: "compliance.score_changed",
      status: "success",
      metadata: {
        previousScore: previous.score,
        newScore: snapshot.score,
      },
    })

    await emitWebhookEvent(identity.orgId, "compliance.score_changed", {
      projectId: project.id,
      projectSlug: project.slug,
      previousScore: previous.score,
      newScore: snapshot.score,
    })
  }

  return c.json({ data: snapshot }, 201)
})

export { app as complianceApi }
