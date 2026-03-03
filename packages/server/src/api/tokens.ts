import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { eq, and } from "drizzle-orm"
import { createHash, randomBytes } from "node:crypto"

const app = new Hono()

function generateToken(): { token: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex")
  const token = `rb_${raw}`
  const hash = createHash("sha256").update(token).digest("hex")
  const prefix = token.slice(0, 10)
  return { token, hash, prefix }
}

app.get("/", async (c) => {
  const db = getDb()
  const orgId = c.req.query("org_id")

  const where = orgId ? eq(schema.apiTokens.orgId, orgId) : undefined
  const tokens = await db.select().from(schema.apiTokens).where(where)

  const safe = tokens.map(({ tokenHash, ...rest }) => rest)
  return c.json({ data: safe })
})

app.post("/", async (c) => {
  const db = getDb()
  const body = await c.req.json()
  const { orgId, userId, name, scopes, expiresAt } = body

  if (!orgId || !userId || !name) {
    return c.json({ error: "Missing required fields: orgId, userId, name" }, 400)
  }

  const { token, hash, prefix } = generateToken()

  const [created] = await db
    .insert(schema.apiTokens)
    .values({
      orgId,
      userId,
      name,
      tokenHash: hash,
      tokenPrefix: prefix,
      scopes: scopes ?? ["read", "validate"],
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning()

  return c.json({
    data: {
      id: created.id,
      name: created.name,
      token,
      prefix,
      scopes: created.scopes,
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
    },
  }, 201)
})

app.delete("/:id", async (c) => {
  const db = getDb()
  const id = c.req.param("id")
  const [deleted] = await db.delete(schema.apiTokens).where(eq(schema.apiTokens.id, id)).returning()
  if (!deleted) return c.json({ error: "Token not found" }, 404)
  return c.json({ data: { deleted: true } })
})

export { app as tokensApi }
