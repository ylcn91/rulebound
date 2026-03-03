import type { NotificationPayload, NotificationProvider, NotificationResult } from "./types.js"

interface SlackBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  elements?: Array<{ type: string; text: string; emoji?: boolean }>
  fields?: Array<{ type: string; text: string }>
}

function severityEmoji(severity?: string): string {
  switch (severity) {
    case "error": return ":red_circle:"
    case "warning": return ":warning:"
    default: return ":large_blue_circle:"
  }
}

function buildSlackBlocks(payload: NotificationPayload): SlackBlock[] {
  const blocks: SlackBlock[] = []

  blocks.push({
    type: "header",
    text: { type: "plain_text", text: `${payload.title}`, emoji: true },
  })

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `${severityEmoji(payload.severity)} ${payload.message}`,
    },
  })

  const fields: Array<{ type: string; text: string }> = []

  if (payload.project) {
    fields.push({ type: "mrkdwn", text: `*Project:*\n${payload.project}` })
  }
  if (payload.rule) {
    fields.push({ type: "mrkdwn", text: `*Rule:*\n${payload.rule}` })
  }
  if (payload.score !== undefined) {
    fields.push({ type: "mrkdwn", text: `*Score:*\n${payload.score}/100` })
  }
  if (payload.event) {
    fields.push({ type: "mrkdwn", text: `*Event:*\n\`${payload.event}\`` })
  }

  if (fields.length > 0) {
    blocks.push({ type: "section", fields })
  }

  if (payload.url) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `<${payload.url}|View in Dashboard>` },
    })
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `Rulebound | ${new Date().toISOString()}` }],
  })

  return blocks
}

export class SlackNotifier implements NotificationProvider {
  readonly name = "slack"
  private readonly webhookUrl: string
  private readonly channel?: string

  constructor(webhookUrl: string, channel?: string) {
    this.webhookUrl = webhookUrl
    this.channel = channel
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const blocks = buildSlackBlocks(payload)

    const slackPayload: Record<string, unknown> = {
      blocks,
      text: `${payload.title}: ${payload.message}`,
    }

    if (this.channel) {
      slackPayload.channel = this.channel
    }

    try {
      const resp = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackPayload),
        signal: AbortSignal.timeout(10_000),
      })

      if (resp.ok) {
        return { success: true, provider: this.name }
      }

      const body = await resp.text()
      return { success: false, provider: this.name, error: `Slack ${resp.status}: ${body}` }
    } catch (err) {
      return {
        success: false,
        provider: this.name,
        error: err instanceof Error ? err.message : "Unknown error",
      }
    }
  }
}
