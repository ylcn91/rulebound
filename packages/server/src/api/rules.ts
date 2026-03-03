import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { eq, ilike, or, arrayContains, and, desc } from "drizzle-orm"

const app = new Hono()

app.get("/", async (c) => {
  const db = getDb()
  const category = c.req.query("category")
  const tag = c.req.query("tag")
  const search = c.req.query("q")
  const stack = c.req.query("stack")
  const limit = parseInt(c.req.query("limit") ?? "100", 10)
  const offset = parseInt(c.req.query("offset") ?? "0", 10)

  const conditions = []

  if (category) conditions.push(eq(schema.rules.category, category))
  if (tag) conditions.push(arrayContains(schema.rules.tags, [tag]))
  if (stack) conditions.push(arrayContains(schema.rules.stack, [stack]))
  if (search) {
    conditions.push(
      or(
        ilike(schema.rules.title, `%${search}%`),
        ilike(schema.rules.content, `%${search}%`)
      )!
    )
  }

  const where = conditions.length > 0
    ? conditions.length === 1 ? conditions[0] : and(...conditions)
    : undefined

  const result = await db
    .select()
    .from(schema.rules)
    .where(where)
    .orderBy(desc(schema.rules.updatedAt))
    .limit(limit)
    .offset(offset)

  return c.json({ data: result, total: result.length })
})

app.get("/:id", async (c) => {
  const db = getDb()
  const id = c.req.param("id")
  const [rule] = await db.select().from(schema.rules).where(eq(schema.rules.id, id))

  if (!rule) return c.json({ error: "Rule not found" }, 404)
  return c.json({ data: rule })
})

app.post("/", async (c) => {
  const db = getDb()
  const body = await c.req.json()
  const { title, content, category, severity, modality, tags, stack, ruleSetId } = body

  if (!title || !content || !category) {
    return c.json({ error: "Missing required fields: title, content, category" }, 400)
  }

  const [created] = await db
    .insert(schema.rules)
    .values({
      title,
      content,
      category,
      severity: severity ?? "warning",
      modality: modality ?? "should",
      tags: tags ?? [],
      stack: stack ?? [],
      ruleSetId: ruleSetId ?? "00000000-0000-0000-0000-000000000000",
    })
    .returning()

  return c.json({ data: created }, 201)
})

app.put("/:id", async (c) => {
  const db = getDb()
  const id = c.req.param("id")
  const body = await c.req.json()

  const [existing] = await db.select().from(schema.rules).where(eq(schema.rules.id, id))
  if (!existing) return c.json({ error: "Rule not found" }, 404)

  await db.insert(schema.ruleVersions).values({
    ruleId: id,
    version: existing.version,
    content: existing.content,
    changeNote: body.changeNote,
  })

  const [updated] = await db
    .update(schema.rules)
    .set({
      title: body.title ?? existing.title,
      content: body.content ?? existing.content,
      category: body.category ?? existing.category,
      severity: body.severity ?? existing.severity,
      modality: body.modality ?? existing.modality,
      tags: body.tags ?? existing.tags,
      stack: body.stack ?? existing.stack,
      isActive: body.isActive ?? existing.isActive,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(schema.rules.id, id))
    .returning()

  return c.json({ data: updated })
})

app.delete("/:id", async (c) => {
  const db = getDb()
  const id = c.req.param("id")

  await db.delete(schema.ruleVersions).where(eq(schema.ruleVersions.ruleId, id))
  const [deleted] = await db.delete(schema.rules).where(eq(schema.rules.id, id)).returning()

  if (!deleted) return c.json({ error: "Rule not found" }, 404)
  return c.json({ data: { deleted: true } })
})

export { app as rulesApi }
