import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "server/webhooks",
  title: "Webhooks",
  description: "Rulebound webhooks — outbound event delivery and inbound GitHub webhook processing.",
  content: `## Webhooks

The Rulebound Server supports both outbound and inbound webhooks. Outbound webhooks notify external services when events occur. Inbound webhooks receive events from GitHub to trigger validation.

### Outbound Webhooks

#### Supported Events

| Event | Trigger |
|-------|---------|
| \`violation.detected\` | A rule violation is found during validation |
| \`compliance.score_changed\` | A project's compliance score changes |
| \`rule.created\` | A new rule is created |
| \`rule.updated\` | An existing rule is updated |
| \`rule.deleted\` | A rule is deleted |
| \`sync.completed\` | A rule sync completes |

#### Registering a Webhook Endpoint

\`\`\`bash
curl -X POST http://localhost:3001/v1/webhooks/endpoints \\
  -H "Content-Type: application/json" \\
  -d '{
    "orgId": "org-uuid",
    "url": "https://hooks.example.com/rulebound",
    "secret": "whsec_your_secret_here_minimum_16_chars",
    "events": ["violation.detected", "compliance.score_changed"],
    "description": "Production webhook"
  }'
\`\`\`

The \`secret\` must be at least 16 characters and is used to sign webhook payloads.

#### Webhook Payload

\`\`\`json
{
  "event": "violation.detected",
  "timestamp": "2026-03-04T12:00:00.000Z",
  "data": {
    "ruleTitle": "No eval()",
    "severity": "error",
    "reason": "eval() call detected in generated code",
    "project": "my-app"
  }
}
\`\`\`

#### Signature Verification

Each delivery includes an HMAC-SHA256 signature in the \`X-Rulebound-Signature\` header:

\`\`\`
X-Rulebound-Signature: sha256=abc123...
X-Rulebound-Event: violation.detected
X-Rulebound-Delivery: unique-delivery-id
User-Agent: Rulebound-Webhook/1.0
\`\`\`

Verify the signature on your server:

\`\`\`typescript
import { createHmac } from "node:crypto"

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = \`sha256=\${createHmac("sha256", secret).update(body).digest("hex")}\`
  return expected === signature
}
\`\`\`

#### Retry Policy

Failed deliveries (5xx responses or network errors) are retried up to 3 times with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1st retry | 1 second |
| 2nd retry | 5 seconds |
| 3rd retry | 30 seconds |

#### Testing a Webhook

\`\`\`bash
curl -X POST http://localhost:3001/v1/webhooks/endpoints/:id/test
\`\`\`

Sends a test payload to verify the endpoint is working.

#### Viewing Deliveries

\`\`\`bash
curl http://localhost:3001/v1/webhooks/deliveries?endpoint_id=uuid&limit=20
\`\`\`

---

### Inbound Webhooks

The server can receive webhooks from GitHub to trigger rule validation on push and pull request events.

#### GitHub Setup

Configure a webhook in your GitHub repository:

| Field | Value |
|-------|-------|
| Payload URL | \`https://your-server.com/v1/webhooks/in\` |
| Content type | \`application/json\` |
| Secret | Your webhook secret |
| Events | Push, Pull requests |

#### Supported GitHub Events

| Event | Parsed Data |
|-------|-------------|
| \`push\` | Branch ref, commits (added/modified/removed files), repository info |
| \`pull_request\` | PR number, title, body, head/base branches, repository info |

#### Signature Verification

Inbound GitHub webhooks are verified using the \`X-Hub-Signature-256\` header. The server checks the signature against registered webhook sources for the \`github\` provider.

### Notifications

The server includes a notification system that can deliver alerts to:

| Provider | Setup |
|----------|-------|
| **Slack** | Webhook URL + optional channel |
| **Microsoft Teams** | Incoming webhook URL |
| **Discord** | Webhook URL |
| **PagerDuty** | Events API v2 routing key |

Notifications are triggered by the same events as outbound webhooks and include formatted messages with severity indicators, project context, and dashboard links.

\`\`\`typescript
import { NotificationManager, SlackNotifier, violationNotification } from "@rulebound/server"

const manager = new NotificationManager()
manager.addProvider({
  type: "slack",
  webhookUrl: "https://hooks.slack.com/services/...",
  channel: "#rulebound-alerts",
  events: ["violation.detected", "compliance.score_changed"],
  enabled: true,
})

const payload = violationNotification({
  ruleName: "No eval()",
  project: "my-app",
  severity: "error",
  reason: "eval() call detected in generated code",
})

await manager.notify(payload)
\`\`\`
`,
}

export default doc
