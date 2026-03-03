import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { eq, and, gt } from "drizzle-orm"
import { createHash } from "node:crypto"

const app = new Hono()

function computeRulesHash(rules: Array<{ id: string; content: string; version: number }>): string {
  const hash = createHash("sha256")
  for (const rule of rules.sort((a, b) => a.id.localeCompare(b.id))) {
    hash.update(`${rule.id}:${rule.version}:${rule.content}`)
  }
  return hash.digest("hex").slice(0, 16)
}

app.get("/", async (c) => {
  const db = getDb()
  const project = c.req.query("project")
  const since = c.req.query("since")
  const stack = c.req.query("stack")

  let dbRules = await db.select().from(schema.rules).where(eq(schema.rules.isActive, true))

  if (since) {
    const sinceDate = new Date(since)
    dbRules = dbRules.filter((r) => r.updatedAt > sinceDate)
  }

  if (stack) {
    const stackList = stack.split(",").map((s) => s.trim().toLowerCase())
    dbRules = dbRules.filter((r) =>
      !r.stack || r.stack.length === 0 || r.stack.some((s) => stackList.includes(s?.toLowerCase() ?? ""))
    )
  }

  const versionHash = computeRulesHash(dbRules)

  const rulesPayload = dbRules.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    severity: r.severity,
    modality: r.modality,
    tags: r.tags ?? [],
    stack: r.stack ?? [],
    version: r.version,
    updatedAt: r.updatedAt,
  }))

  return c.json({
    data: rulesPayload,
    meta: {
      total: rulesPayload.length,
      versionHash,
      syncedAt: new Date().toISOString(),
    },
  })
})

app.post("/ack", async (c) => {
  const db = getDb()
  const body = await c.req.json()
  const { projectId, ruleVersionHash } = body

  if (!projectId || !ruleVersionHash) {
    return c.json({ error: "Missing projectId or ruleVersionHash" }, 400)
  }

  const [existing] = await db
    .select()
    .from(schema.ruleSyncState)
    .where(eq(schema.ruleSyncState.projectId, projectId))

  if (existing) {
    await db
      .update(schema.ruleSyncState)
      .set({ ruleVersionHash, status: "synced", lastSyncedAt: new Date() })
      .where(eq(schema.ruleSyncState.id, existing.id))
  } else {
    await db.insert(schema.ruleSyncState).values({ projectId, ruleVersionHash, status: "synced" })
  }

  return c.json({ data: { synced: true } })
})

export { app as syncApi }
