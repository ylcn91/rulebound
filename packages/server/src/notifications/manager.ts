import type { NotificationPayload, NotificationProvider, NotificationResult } from "./types.js"
import { SlackNotifier } from "./slack.js"
import { TeamsNotifier } from "./teams.js"
import { DiscordNotifier } from "./discord.js"
import { PagerDutyNotifier } from "./pagerduty.js"

export type ProviderType = "slack" | "teams" | "discord" | "pagerduty" | "custom"

export interface ProviderConfig {
  type: ProviderType
  webhookUrl: string
  channel?: string
  events: string[]
  enabled: boolean
}

export class NotificationManager {
  private readonly providers: Array<{ config: ProviderConfig; provider: NotificationProvider }> = []

  addProvider(config: ProviderConfig): void {
    if (!config.enabled) return

    let provider: NotificationProvider

    switch (config.type) {
      case "slack":
        provider = new SlackNotifier(config.webhookUrl, config.channel)
        break
      case "teams":
        provider = new TeamsNotifier(config.webhookUrl)
        break
      case "discord":
        provider = new DiscordNotifier(config.webhookUrl)
        break
      case "pagerduty":
        provider = new PagerDutyNotifier(config.webhookUrl)
        break
      default:
        return
    }

    this.providers.push({ config, provider })
  }

  async notify(payload: NotificationPayload): Promise<NotificationResult[]> {
    const results: NotificationResult[] = []

    const matching = this.providers.filter(
      ({ config }) => config.events.includes(payload.event) || config.events.includes("*")
    )

    const deliveries = await Promise.allSettled(
      matching.map(({ provider }) => provider.send(payload))
    )

    for (const delivery of deliveries) {
      if (delivery.status === "fulfilled") {
        results.push(delivery.value)
      } else {
        results.push({
          success: false,
          provider: "unknown",
          error: delivery.reason instanceof Error ? delivery.reason.message : "Unknown error",
        })
      }
    }

    return results
  }

  get providerCount(): number {
    return this.providers.length
  }
}

// Convenience: create notification payloads for common events
export function violationNotification(opts: {
  ruleName: string
  project: string
  severity: "error" | "warning"
  reason: string
  dashboardUrl?: string
}): NotificationPayload {
  return {
    event: "violation.detected",
    title: "Rule Violation Detected",
    message: `**${opts.ruleName}**: ${opts.reason}`,
    severity: opts.severity,
    project: opts.project,
    rule: opts.ruleName,
    url: opts.dashboardUrl,
  }
}

export function scoreChangedNotification(opts: {
  project: string
  oldScore: number
  newScore: number
  dashboardUrl?: string
}): NotificationPayload {
  const direction = opts.newScore > opts.oldScore ? "improved" : "dropped"
  const severity = opts.newScore < 70 ? "error" as const : opts.newScore < 85 ? "warning" as const : "info" as const

  return {
    event: "compliance.score_changed",
    title: `Compliance Score ${direction.charAt(0).toUpperCase() + direction.slice(1)}`,
    message: `${opts.project} compliance score ${direction} from ${opts.oldScore} to ${opts.newScore}`,
    severity,
    project: opts.project,
    score: opts.newScore,
    url: opts.dashboardUrl,
  }
}

export function ruleUpdatedNotification(opts: {
  ruleName: string
  changeNote?: string
  dashboardUrl?: string
}): NotificationPayload {
  return {
    event: "rule.updated",
    title: "Rule Updated",
    message: `Rule "${opts.ruleName}" was updated${opts.changeNote ? `: ${opts.changeNote}` : ""}`,
    severity: "info",
    rule: opts.ruleName,
    url: opts.dashboardUrl,
  }
}
