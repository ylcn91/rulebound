import type { NotificationPayload, NotificationProvider, NotificationResult } from "./types.js"

export class DiscordNotifier implements NotificationProvider {
  readonly name = "discord"
  private readonly webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const color = payload.severity === "error" ? 0xff0000
      : payload.severity === "warning" ? 0xffa500
      : 0x0078d4

    const fields: Array<{ name: string; value: string; inline: boolean }> = []
    if (payload.project) fields.push({ name: "Project", value: payload.project, inline: true })
    if (payload.rule) fields.push({ name: "Rule", value: payload.rule, inline: true })
    if (payload.score !== undefined) fields.push({ name: "Score", value: `${payload.score}/100`, inline: true })
    fields.push({ name: "Event", value: `\`${payload.event}\``, inline: true })

    const embed: Record<string, unknown> = {
      title: payload.title,
      description: payload.message,
      color,
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: "Rulebound" },
    }

    if (payload.url) {
      embed.url = payload.url
    }

    try {
      const resp = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
        signal: AbortSignal.timeout(10_000),
      })

      if (resp.ok || resp.status === 204) {
        return { success: true, provider: this.name }
      }

      const body = await resp.text()
      return { success: false, provider: this.name, error: `Discord ${resp.status}: ${body}` }
    } catch (err) {
      return {
        success: false,
        provider: this.name,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  }
}
