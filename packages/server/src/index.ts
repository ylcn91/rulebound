import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { serve } from "@hono/node-server"
import { validateApi } from "./api/validate.js"
import { rulesApi } from "./api/rules.js"
import { auditApi } from "./api/audit.js"
import { complianceApi } from "./api/compliance.js"
import { syncApi } from "./api/sync.js"
import { webhooksApi } from "./api/webhooks.js"
import { tokensApi } from "./api/tokens.js"
import { analyticsApi } from "./api/analytics.js"
import { authMiddleware, optionalAuth } from "./middleware/auth.js"

export function createApp() {
  const app = new Hono()

  app.use("*", cors())
  app.use("*", logger())

  app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }))

  // Public endpoints (webhook inbound needs to be open)
  app.route("/v1/webhooks", webhooksApi)

  // Protected endpoints
  app.use("/v1/*", optionalAuth())
  app.route("/v1/validate", validateApi)
  app.route("/v1/rules", rulesApi)
  app.route("/v1/audit", auditApi)
  app.route("/v1/compliance", complianceApi)
  app.route("/v1/sync", syncApi)
  app.route("/v1/tokens", tokensApi)
  app.route("/v1/analytics", analyticsApi)

  return app
}

export type AppType = ReturnType<typeof createApp>

// Start server when run directly
const isDirectRun = process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts")

if (isDirectRun) {
  const port = parseInt(process.env.PORT ?? "3001", 10)
  const app = createApp()

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Rulebound API server running on http://localhost:${info.port}`)
    console.log(`Health check: http://localhost:${info.port}/health`)
  })
}

// Re-export everything for library usage
export { validateApi } from "./api/validate.js"
export { rulesApi } from "./api/rules.js"
export { auditApi } from "./api/audit.js"
export { complianceApi } from "./api/compliance.js"
export { syncApi } from "./api/sync.js"
export { webhooksApi, dispatchWebhooks } from "./api/webhooks.js"
export { tokensApi } from "./api/tokens.js"
export { analyticsApi } from "./api/analytics.js"
export { authMiddleware, optionalAuth } from "./middleware/auth.js"
export { getDb, schema } from "./db/index.js"
export { signPayload, deliverWebhook } from "./webhooks/dispatcher.js"
export { verifyGitHubSignature, parseGitHubEvent } from "./webhooks/receivers.js"
export type { WebhookEvent, WebhookPayload, DeliveryResult } from "./webhooks/dispatcher.js"
export type { InboundEvent, GitHubPushEvent, GitHubPREvent } from "./webhooks/receivers.js"

// Notification providers
export { NotificationManager, violationNotification, scoreChangedNotification, ruleUpdatedNotification } from "./notifications/manager.js"
export { SlackNotifier } from "./notifications/slack.js"
export { TeamsNotifier } from "./notifications/teams.js"
export { DiscordNotifier } from "./notifications/discord.js"
export { PagerDutyNotifier } from "./notifications/pagerduty.js"
export type { NotificationPayload, NotificationResult, NotificationProvider } from "./notifications/types.js"
export type { ProviderConfig, ProviderType } from "./notifications/manager.js"
