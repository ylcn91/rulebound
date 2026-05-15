import { createHmac } from "node:crypto"
import {
  assertSafeOutboundUrl,
  UnsafeOutboundUrlError,
} from "../lib/url-policy.js"

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
const MAX_RESPONSE_BODY_BYTES = 8 * 1024

async function readBoundedBody(response: Response): Promise<string | undefined> {
  if (!response.body) return undefined
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < MAX_RESPONSE_BODY_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      const remaining = MAX_RESPONSE_BODY_BYTES - total
      if (value.byteLength <= remaining) {
        chunks.push(value)
        total += value.byteLength
      } else {
        chunks.push(value.subarray(0, remaining))
        total += remaining
        break
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // ignore cancel errors; we are not consuming the rest of the body
    }
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(
    Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
  )
}

export async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  secret: string,
  attempt = 0
): Promise<DeliveryResult> {
  // Re-validate before each attempt: DNS rebind defense (B3).
  try {
    await assertSafeOutboundUrl(url)
  } catch (err) {
    if (err instanceof UnsafeOutboundUrlError) {
      return { success: false, error: err.message }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }

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
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok) {
      // Drain (bounded) so connection can release; we ignore content.
      await readBoundedBody(response)
      return { success: true, statusCode: response.status }
    }

    // 3xx without manual follow → treat as failure; do not retry redirects.
    if (response.status >= 300 && response.status < 400) {
      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}: redirect not followed`,
      }
    }

    if (attempt < MAX_RETRIES - 1 && response.status >= 500) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
      return deliverWebhook(url, payload, secret, attempt + 1)
    }

    const errorBody = await readBoundedBody(response)
    return {
      success: false,
      statusCode: response.status,
      error: errorBody
        ? `HTTP ${response.status}: ${response.statusText} — ${errorBody}`
        : `HTTP ${response.status}: ${response.statusText}`,
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
