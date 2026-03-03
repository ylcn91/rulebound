import { Hono } from "hono"
import { getDb, schema } from "../db/index.js"
import { eq } from "drizzle-orm"
import { deliverWebhook, type WebhookEvent, type WebhookPayload } from "../webhooks/dispatcher.js"
import { verifyGitHubSignature, parseGitHubEvent } from "../webhooks/receivers.js"

const app = new Hono()

// --- Outbound webhook management ---

app.get("/endpoints", async (c) => {
  const db = getDb()
  const orgId = c.req.query("org_id")

  const endpoints = orgId
    ? await db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.orgId, orgId))
    : await db.select().from(schema.webhookEndpoints)

  const safe = endpoints.map(({ secret, ...rest }) => rest)
  return c.json({ data: safe })
})

app.post("/endpoints", async (c) => {
  const db = getDb()
  const body = await c.req.json()
  const { orgId, url, secret, events, description } = body

  if (!orgId || !url || !secret || !events?.length) {
    return c.json({ error: "Missing required fields: orgId, url, secret, events" }, 400)
  }

  const [created] = await db
    .insert(schema.webhookEndpoints)
    .values({ orgId, url, secret, events, description })
    .returning()

  const { secret: _, ...safe } = created
  return c.json({ data: safe }, 201)
})

app.delete("/endpoints/:id", async (c) => {
  const db = getDb()
  const id = c.req.param("id")
  const [deleted] = await db.delete(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, id)).returning()
  if (!deleted) return c.json({ error: "Endpoint not found" }, 404)
  return c.json({ data: { deleted: true } })
})

app.post("/endpoints/:id/test", async (c) => {
  const db = getDb()
  const id = c.req.param("id")

  const [endpoint] = await db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, id))
  if (!endpoint) return c.json({ error: "Endpoint not found" }, 404)

  const testPayload: WebhookPayload = {
    event: "violation.detected",
    timestamp: new Date().toISOString(),
    data: { test: true, message: "This is a test webhook delivery from Rulebound" },
  }

  const result = await deliverWebhook(endpoint.url, testPayload, endpoint.secret)

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
  const db = getDb()
  const endpointId = c.req.query("endpoint_id")
  const limit = parseInt(c.req.query("limit") ?? "20", 10)

  const where = endpointId ? eq(schema.webhookDeliveries.endpointId, endpointId) : undefined
  const deliveries = await db.select().from(schema.webhookDeliveries).where(where).limit(limit)

  return c.json({ data: deliveries })
})

// --- Inbound webhooks ---

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
      // TODO: trigger validation pipeline based on event
      return c.json({ received: true, event: event.type })
    }
  }

  return c.json({ received: true })
})

// --- Dispatch helper (used by other modules) ---

export async function dispatchWebhooks(
  orgId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const db = getDb()
  const endpoints = await db
    .select()
    .from(schema.webhookEndpoints)
    .where(eq(schema.webhookEndpoints.orgId, orgId))

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }

  for (const endpoint of endpoints) {
    if (!endpoint.isActive) continue
    if (!endpoint.events.includes(event)) continue

    const result = await deliverWebhook(endpoint.url, payload, endpoint.secret)

    await db.insert(schema.webhookDeliveries).values({
      endpointId: endpoint.id,
      event,
      payload,
      status: result.success ? "delivered" : "failed",
      responseCode: result.statusCode,
      responseBody: result.error,
      attempts: 1,
    })
  }
}

export { app as webhooksApi }
