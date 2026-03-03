import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { eq, desc, and, gte } from "drizzle-orm"

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
  const body = await c.req.json()
  const { score, passCount, violatedCount, notCoveredCount } = body

  if (score === undefined) {
    return c.json({ error: "Missing required field: score" }, 400)
  }

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
