import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "deployment/environment-variables",
  title: "Environment Variables",
  description: "Complete reference of all environment variables used by Rulebound Server, Gateway, and CLI.",
  content: `## Environment Variables

Complete reference for all environment variables across Rulebound components.

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| \`PORT\` | No | \`3001\` | HTTP port for the API server |
| \`DATABASE_URL\` | Yes | — | PostgreSQL connection string |
| \`WEBHOOK_ENCRYPTION_KEY\` | No | — | 32-byte hex key for encrypting webhook secrets |
| \`NODE_ENV\` | No | \`development\` | Environment mode |

**DATABASE_URL format:**

\`\`\`
postgresql://user:password@host:5432/rulebound
postgresql://user:password@host:5432/rulebound?sslmode=require
\`\`\`

### Gateway

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| \`GATEWAY_PORT\` | No | \`4000\` | HTTP port for the gateway |
| \`RULEBOUND_SERVER_URL\` | No | — | URL of the Rulebound API server |
| \`RULEBOUND_API_KEY\` | No | — | Bearer token for server authentication |
| \`RULEBOUND_ENFORCEMENT\` | No | \`advisory\` | Enforcement mode |
| \`RULEBOUND_INJECT_RULES\` | No | \`true\` | Enable rule injection |
| \`RULEBOUND_SCAN_RESPONSES\` | No | \`true\` | Enable response scanning |
| \`RULEBOUND_AUDIT_LOG\` | No | \`true\` | Enable audit logging |
| \`RULEBOUND_PROJECT\` | No | — | Project ID for rule filtering |
| \`RULEBOUND_STACK\` | No | — | Comma-separated tech stack |
| \`OPENAI_TARGET_URL\` | No | \`https://api.openai.com\` | Override OpenAI target |
| \`ANTHROPIC_TARGET_URL\` | No | \`https://api.anthropic.com\` | Override Anthropic target |
| \`GOOGLE_TARGET_URL\` | No | \`https://generativelanguage.googleapis.com\` | Override Google target |

### Enforcement Modes

| Mode | Description |
|------|-------------|
| \`advisory\` | Warnings appended to responses, no blocking |
| \`moderate\` | Warnings appended, violations logged |
| \`strict\` | Responses with violations are blocked (HTTP 422) |

### Boolean Variables

Boolean environment variables are disabled by setting them to the string \`"false"\`:

\`\`\`bash
RULEBOUND_INJECT_RULES=false    # Disabled
RULEBOUND_INJECT_RULES=true     # Enabled (default)
RULEBOUND_INJECT_RULES=         # Enabled (any value except "false")
\`\`\`

### Example Configurations

#### Development

\`\`\`bash
# .env.development
DATABASE_URL=postgresql://localhost:5432/rulebound_dev
PORT=3001
GATEWAY_PORT=4000
RULEBOUND_SERVER_URL=http://localhost:3001
RULEBOUND_ENFORCEMENT=advisory
\`\`\`

#### Staging

\`\`\`bash
# .env.staging
DATABASE_URL=postgresql://user:pass@staging-db:5432/rulebound?sslmode=require
PORT=3001
GATEWAY_PORT=4000
RULEBOUND_SERVER_URL=https://rules-staging.example.com
RULEBOUND_API_KEY=rb_staging_token
RULEBOUND_ENFORCEMENT=moderate
RULEBOUND_STACK=typescript,react
\`\`\`

#### Production

\`\`\`bash
# .env.production
DATABASE_URL=postgresql://user:pass@prod-db:5432/rulebound?sslmode=require
PORT=3001
GATEWAY_PORT=4000
RULEBOUND_SERVER_URL=https://rules.example.com
RULEBOUND_API_KEY=rb_prod_token
RULEBOUND_ENFORCEMENT=strict
RULEBOUND_STACK=typescript,react
RULEBOUND_PROJECT=my-app
RULEBOUND_AUDIT_LOG=true
\`\`\`

### Security Notes

- Never commit \`.env\` files to version control
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) for production
- Rotate \`RULEBOUND_API_KEY\` periodically
- Use \`sslmode=require\` for production database connections
- The \`WEBHOOK_ENCRYPTION_KEY\` should be a cryptographically random 32-byte hex string
`,
}

export default doc
