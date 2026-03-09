import { eq } from "drizzle-orm"
import { getDb, schema } from "../db/index.js"
import { decrypt } from "../lib/crypto.js"
import { deliverWebhook, type WebhookEvent, type WebhookPayload } from "./dispatcher.js"

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
    if (!endpoint.isActive) {
      continue
    }

    if (!endpoint.events.includes(event)) {
      continue
    }

    const plainSecret = decrypt(endpoint.encryptedSecret)
    const result = await deliverWebhook(endpoint.url, payload, plainSecret)

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
