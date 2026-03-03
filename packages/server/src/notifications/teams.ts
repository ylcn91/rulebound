import type { NotificationPayload, NotificationProvider, NotificationResult } from "./types.js"

interface TeamsSection {
  activityTitle: string
  activitySubtitle?: string
  facts?: Array<{ name: string; value: string }>
  markdown: boolean
}

function severityColor(severity?: string): string {
  switch (severity) {
    case "error": return "FF0000"
    case "warning": return "FFA500"
    default: return "0078D4"
  }
}

function buildTeamsCard(payload: NotificationPayload): Record<string, unknown> {
  const facts: Array<{ name: string; value: string }> = []

  if (payload.project) facts.push({ name: "Project", value: payload.project })
  if (payload.rule) facts.push({ name: "Rule", value: payload.rule })
  if (payload.score !== undefined) facts.push({ name: "Score", value: `${payload.score}/100` })
  facts.push({ name: "Event", value: `\`${payload.event}\`` })

  const sections: TeamsSection[] = [
    {
      activityTitle: payload.title,
      activitySubtitle: payload.message,
      facts,
      markdown: true,
    },
  ]

  const card: Record<string, unknown> = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: severityColor(payload.severity),
    summary: payload.title,
    sections,
  }

  if (payload.url) {
    card.potentialAction = [
      {
        "@type": "OpenUri",
        name: "View in Dashboard",
        targets: [{ os: "default", uri: payload.url }],
      },
    ]
  }

  return card
}

export class TeamsNotifier implements NotificationProvider {
  readonly name = "teams"
  private readonly webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const card = buildTeamsCard(payload)

    try {
      const resp = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
        signal: AbortSignal.timeout(10_000),
      })

      if (resp.ok) {
        return { success: true, provider: this.name }
      }

      const body = await resp.text()
      return { success: false, provider: this.name, error: `Teams ${resp.status}: ${body}` }
    } catch (err) {
      return {
        success: false,
        provider: this.name,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  }
}
