import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { eq, desc, and, gte, lte } from "drizzle-orm"
import { auditCreateSchema } from "../schemas.js"

const app = new Hono()

app.get("/", async (c) => {
  const db = getDb()
  const orgId = c.req.query("org_id")
  const projectId = c.req.query("project_id")
  const action = c.req.query("action")
  const since = c.req.query("since")
  const until = c.req.query("until")
  const limit = parseInt(c.req.query("limit") ?? "50", 10)
  const offset = parseInt(c.req.query("offset") ?? "0", 10)

  const conditions = []

  if (orgId) conditions.push(eq(schema.auditLog.orgId, orgId))
  if (projectId) conditions.push(eq(schema.auditLog.projectId, projectId))
  if (action) conditions.push(eq(schema.auditLog.action, action))
  if (since) conditions.push(gte(schema.auditLog.createdAt, new Date(since)))
  if (until) conditions.push(lte(schema.auditLog.createdAt, new Date(until)))

  const where = conditions.length > 0
    ? conditions.length === 1 ? conditions[0] : and(...conditions)
    : undefined

  const result = await db
    .select()
    .from(schema.auditLog)
    .where(where)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit)
    .offset(offset)

  return c.json({ data: result, total: result.length })
})

app.post("/", async (c) => {
  const db = getDb()
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = auditCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const { orgId, projectId, userId, action, ruleId, status, metadata } = parsed.data

  const [created] = await db
    .insert(schema.auditLog)
    .values({ orgId, projectId, userId, action, ruleId, status, metadata })
    .returning()

  return c.json({ data: created }, 201)
})

export { app as auditApi }
