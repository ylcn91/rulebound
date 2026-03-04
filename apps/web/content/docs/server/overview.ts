import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "server/overview",
  title: "Server Overview",
  description: "Rulebound Server — centralized API for rule management, validation, audit logging, compliance tracking, and webhook delivery.",
  content: `## Server Overview

The Rulebound Server is a centralized API service for managing rules, validating code, tracking compliance, and dispatching notifications. It provides a REST API that the gateway, CLI, and other tools connect to.

### Architecture

\`\`\`
Gateway / CLI / MCP / LSP
          |
          v
    Rulebound Server (Hono)
          |
    +-----+-----+-----+-----+
    |     |     |     |     |
  Rules  Validate  Audit  Sync  Webhooks
    |     |     |     |     |
    v     v     v     v     v
         PostgreSQL (Drizzle ORM)
\`\`\`

### Features

- **Rule Management** — CRUD operations for rules with versioning
- **Validation API** — Validate code/plans against rules
- **Audit Logging** — Track every validation and violation
- **Compliance Tracking** — Score snapshots over time per project
- **Rule Sync** — Distribute rules to gateways and agents
- **Webhooks** — Outbound webhook delivery for events
- **Inbound Webhooks** — Receive GitHub push/PR events
- **Notifications** — Slack, Teams, Discord, PagerDuty integration
- **API Tokens** — Token-based authentication with scopes

### Quick Start

\`\`\`bash
# Set up the database
export DATABASE_URL=postgresql://user:pass@localhost:5432/rulebound

# Start the server
pnpm add @rulebound/server
PORT=3001 npx rulebound-server
\`\`\`

### Health Check

\`\`\`bash
curl http://localhost:3001/health
# {"status":"ok","version":"0.1.0"}
\`\`\`

### API Routes

| Prefix | Module | Description |
|--------|--------|-------------|
| \`/v1/rules\` | Rules API | CRUD operations for rules |
| \`/v1/validate\` | Validate API | Code and plan validation |
| \`/v1/audit\` | Audit API | Audit log queries and entries |
| \`/v1/compliance\` | Compliance API | Score tracking and snapshots |
| \`/v1/sync\` | Sync API | Rule distribution to clients |
| \`/v1/tokens\` | Tokens API | API token management |
| \`/v1/webhooks\` | Webhooks API | Webhook endpoint management |

### Authentication

The server uses Bearer token authentication. All \`/v1/*\` endpoints support optional authentication — authenticated requests get org-scoped data.

\`\`\`bash
curl -H "Authorization: Bearer rb_your_token_here" \\
  http://localhost:3001/v1/rules
\`\`\`

### Tech Stack

- **Framework**: Hono (lightweight, fast HTTP framework)
- **Database**: PostgreSQL 17 with Drizzle ORM
- **Auth**: SHA-256 hashed API tokens
- **Validation**: Zod schemas for all request bodies

### Programmatic Usage

\`\`\`typescript
import { createApp } from "@rulebound/server"
import { serve } from "@hono/node-server"

const app = createApp()
serve({ fetch: app.fetch, port: 3001 })
\`\`\`

### Next Steps

- [REST API](/docs/server/rest-api) — Complete endpoint reference
- [Authentication](/docs/server/authentication) — Token management
- [Webhooks](/docs/server/webhooks) — Webhook configuration
`,
}

export default doc
