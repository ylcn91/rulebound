import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { eq, desc, and, gte, lte } from "drizzle-orm"

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
  const body = await c.req.json()
  const { orgId, projectId, userId, action, ruleId, status, metadata } = body

  if (!orgId || !action || !status) {
    return c.json({ error: "Missing required fields: orgId, action, status" }, 400)
  }

  const [created] = await db
    .insert(schema.auditLog)
    .values({ orgId, projectId, userId, action, ruleId, status, metadata })
    .returning()

  return c.json({ data: created }, 201)
})

export { app as auditApi }
