import type { NotificationPayload, NotificationProvider, NotificationResult } from "./types.js"

export class PagerDutyNotifier implements NotificationProvider {
  readonly name = "pagerduty"
  private readonly routingKey: string

  constructor(routingKey: string) {
    this.routingKey = routingKey
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const pdSeverity = payload.severity === "error" ? "critical"
      : payload.severity === "warning" ? "warning"
      : "info"

    const pdPayload = {
      routing_key: this.routingKey,
      event_action: "trigger",
      payload: {
        summary: `${payload.title}: ${payload.message}`,
        severity: pdSeverity,
        source: "rulebound",
        component: payload.project ?? "unknown",
        group: payload.event,
        custom_details: {
          rule: payload.rule,
          score: payload.score,
          event: payload.event,
          ...payload.metadata,
        },
      },
      links: payload.url ? [{ href: payload.url, text: "View in Dashboard" }] : undefined,
    }

    try {
      const resp = await fetch("https://events.pagerduty.com/v2/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdPayload),
        signal: AbortSignal.timeout(10_000),
      })

      if (resp.ok) {
        return { success: true, provider: this.name }
      }

      const body = await resp.text()
      return { success: false, provider: this.name, error: `PagerDuty ${resp.status}: ${body}` }
    } catch (err) {
      return {
        success: false,
        provider: this.name,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  }
}
