import { Hono } from "hono"
import { and, eq, inArray } from "drizzle-orm"
import { getDb, schema } from "../db/index.js"
import { deliverWebhook, type WebhookPayload } from "../webhooks/dispatcher.js"
import { verifyGitHubSignature, parseGitHubEvent } from "../webhooks/receivers.js"
import { webhookEndpointCreateSchema } from "../schemas.js"
import { encrypt, decrypt } from "../lib/crypto.js"
import { requireMatchingOrg, requireRequestIdentity } from "../lib/request-context.js"

const app = new Hono()

function secretPrefix(secret: string): string {
  return secret.slice(0, 8) + "..."
}

app.get("/endpoints", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const orgScope = requireMatchingOrg(c, identity, c.req.query("org_id"))
  if (orgScope instanceof Response) return orgScope

  const db = getDb()
  const endpoints = await db
    .select()
    .from(schema.webhookEndpoints)
    .where(eq(schema.webhookEndpoints.orgId, identity.orgId))

  const safe = endpoints.map(({ encryptedSecret, ...rest }) => ({
    ...rest,
    secretPrefix: rest.secretHash,
  }))

  return c.json({ data: safe })
})

app.post("/endpoints", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const raw = await c.req.json().catch(() => null)
  if (!raw) return c.json({ error: "Invalid JSON" }, 400)

  const parsed = webhookEndpointCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400)
  }

  const encryptedSecret = encrypt(parsed.data.secret)
  const secretHash = secretPrefix(parsed.data.secret)

  const [created] = await db
    .insert(schema.webhookEndpoints)
    .values({
      orgId: identity.orgId,
      url: parsed.data.url,
      encryptedSecret,
      secretHash,
      events: parsed.data.events,
      description: parsed.data.description,
    })
    .returning()

  const { encryptedSecret: _, ...safe } = created
  return c.json({ data: { ...safe, secret: parsed.data.secret } }, 201)
})

app.delete("/endpoints/:id", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const id = c.req.param("id")

  await db.delete(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.endpointId, id))

  const [deleted] = await db
    .delete(schema.webhookEndpoints)
    .where(and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.orgId, identity.orgId)))
    .returning()

  if (!deleted) return c.json({ error: "Endpoint not found" }, 404)
  return c.json({ data: { deleted: true } })
})

app.post("/endpoints/:id/test", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const id = c.req.param("id")
  const [endpoint] = await db
    .select()
    .from(schema.webhookEndpoints)
    .where(and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.orgId, identity.orgId)))

  if (!endpoint) return c.json({ error: "Endpoint not found" }, 404)

  const plainSecret = decrypt(endpoint.encryptedSecret)

  const testPayload: WebhookPayload = {
    event: "violation.detected",
    timestamp: new Date().toISOString(),
    data: { test: true, message: "This is a test webhook delivery from Rulebound" },
  }

  const result = await deliverWebhook(endpoint.url, testPayload, plainSecret)

  await db.insert(schema.webhookDeliveries).values({
    endpointId: id,
    event: "test",
    payload: testPayload,
    status: result.success ? "delivered" : "failed",
    responseCode: result.statusCode,
    responseBody: result.error,
    attempts: 1,
  })

  return c.json({ data: result })
})

app.get("/deliveries", async (c) => {
  const identity = requireRequestIdentity(c)
  if (identity instanceof Response) return identity

  const db = getDb()
  const endpointId = c.req.query("endpoint_id")
  const limit = parseInt(c.req.query("limit") ?? "20", 10)

  const endpoints = endpointId
    ? await db
      .select()
      .from(schema.webhookEndpoints)
      .where(and(eq(schema.webhookEndpoints.id, endpointId), eq(schema.webhookEndpoints.orgId, identity.orgId)))
    : await db
      .select()
      .from(schema.webhookEndpoints)
      .where(eq(schema.webhookEndpoints.orgId, identity.orgId))

  if (endpointId && endpoints.length === 0) {
    return c.json({ error: "Endpoint not found" }, 404)
  }

  const endpointIds = endpoints.map((endpoint) => endpoint.id)
  if (endpointIds.length === 0) {
    return c.json({ data: [] })
  }

  const deliveries = await db
    .select()
    .from(schema.webhookDeliveries)
    .where(inArray(schema.webhookDeliveries.endpointId, endpointIds))
    .limit(limit)

  return c.json({ data: deliveries })
})

app.post("/in", async (c) => {
  const provider = c.req.header("X-GitHub-Event") ? "github" : "generic"
  const rawBody = await c.req.text()
  const payload = JSON.parse(rawBody)

  if (provider === "github") {
    const signature = c.req.header("X-Hub-Signature-256")
    const db = getDb()
    const sources = await db.select().from(schema.webhookSources).where(eq(schema.webhookSources.provider, "github"))

    let verified = false
    for (const source of sources) {
      if (signature && verifyGitHubSignature(rawBody, signature, source.secret)) {
        verified = true
        break
      }
    }

    if (!verified && sources.length > 0) {
      return c.json({ error: "Invalid signature" }, 401)
    }

    const eventType = c.req.header("X-GitHub-Event") ?? "unknown"
    const event = parseGitHubEvent(eventType, payload)

    if (event) {
      return c.json({ received: true, event: event.type })
    }
  }

  return c.json({ received: true })
})

export { dispatchWebhooks } from "../webhooks/service.js"
export { app as webhooksApi }
