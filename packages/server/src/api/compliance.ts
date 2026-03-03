import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { eq, desc, and, gte } from "drizzle-orm"
import { complianceSnapshotSchema } from "../schemas.js"

const app = new Hono()

app.get("/:projectId", async (c) => {
  const db = getDb()
  const projectId = c.req.param("projectId")
  const since = c.req.query("since")
  const limit = parseInt(c.req.query("limit") ?? "30", 10)

  const conditions = [eq(schema.complianceSnapshots.projectId, projectId)]
  if (since) conditions.push(gte(schema.complianceSnapshots.snapshotAt, new Date(since)))

  const snapshots = await db
    .select()
    .from(schema.complianceSnapshots)
    .where(and(...conditions))
    .orderBy(desc(schema.complianceSnapshots.snapshotAt))
    .limit(limit)

  const latest = snapshots[0]

  return c.json({
    data: {
      projectId,
      currentScore: latest?.score ?? null,
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

app.post("/:projectId/snapshot", async (c) => {
  const db = getDb()
  const projectId = c.req.param("projectId")
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = complianceSnapshotSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const { score, passCount, violatedCount, notCoveredCount } = parsed.data

  const [snapshot] = await db
    .insert(schema.complianceSnapshots)
    .values({
      projectId,
      score,
      passCount: passCount ?? 0,
      violatedCount: violatedCount ?? 0,
      notCoveredCount: notCoveredCount ?? 0,
    })
    .returning()

  return c.json({ data: snapshot }, 201)
})

export { app as complianceApi }
