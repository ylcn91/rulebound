import { Hono } from "hono"
import { and, eq } from "drizzle-orm"
import { createHash, randomBytes } from "node:crypto"
import { getDb, schema } from "../db/index.js"
import { tokenCreateSchema } from "../schemas.js"
import { requireMatchingOrg, requireRequestIdentity } from "../lib/request-context.js"

const app = new Hono()

function generateToken(): { token: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex")
  const token = `rb_${raw}`
  const hash = createHash("sha256").update(token).digest("hex")
  const prefix = token.slice(0, 10)
  return { token, hash, prefix }
}

app.get("/", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const orgScope = requireMatchingOrg(c, identity, c.req.query("org_id"))
  if (orgScope instanceof Response) return orgScope

  const db = getDb()
  const tokens = await db
    .select()
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.orgId, identity.orgId))

  const safe = tokens.map(({ tokenHash, ...rest }) => rest)
  return c.json({ data: safe })
})

app.post("/", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = tokenCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const { token, hash, prefix } = generateToken()

  const [created] = await db
    .insert(schema.apiTokens)
    .values({
      orgId: identity.orgId,
      userId: identity.userId,
      name: parsed.data.name,
      tokenHash: hash,
      tokenPrefix: prefix,
      scopes: parsed.data.scopes ?? ["read", "validate"],
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
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
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const id = c.req.param("id")
  const [deleted] = await db
    .delete(schema.apiTokens)
    .where(and(eq(schema.apiTokens.id, id), eq(schema.apiTokens.orgId, identity.orgId)))
    .returning()

  if (!deleted) return c.json({ error: "Token not found" }, 404)
  return c.json({ data: { deleted: true } })
})

export { app as tokensApi }
