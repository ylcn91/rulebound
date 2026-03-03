import { createHmac } from "node:crypto"

export type WebhookEvent =
  | "violation.detected"
  | "compliance.score_changed"
  | "rule.created"
  | "rule.updated"
  | "rule.deleted"
  | "sync.completed"

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
}

export interface DeliveryResult {
  success: boolean
  statusCode?: number
  error?: string
}

export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 30000]

export async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  secret: string,
  attempt = 0
): Promise<DeliveryResult> {
  const body = JSON.stringify(payload)
  const signature = signPayload(body, secret)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Rulebound-Signature": `sha256=${signature}`,
        "X-Rulebound-Event": payload.event,
        "X-Rulebound-Delivery": crypto.randomUUID(),
        "User-Agent": "Rulebound-Webhook/1.0",
      },
      body,
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok) {
      return { success: true, statusCode: response.status }
    }

    if (attempt < MAX_RETRIES - 1 && response.status >= 500) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
      return deliverWebhook(url, payload, secret, attempt + 1)
    }

    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${response.statusText}`,
    }
  } catch (err) {
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
      return deliverWebhook(url, payload, secret, attempt + 1)
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
