import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "gateway/middleware",
  title: "Gateway Configuration",
  description: "Complete configuration reference for the Rulebound Gateway including environment variables, targets, and enforcement settings.",
  content: `## Gateway Configuration

The gateway is configured entirely through environment variables. No config files are needed.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| \`GATEWAY_PORT\` | \`4000\` | Port the gateway listens on |
| \`RULEBOUND_SERVER_URL\` | — | URL of the Rulebound API server for fetching rules |
| \`RULEBOUND_API_KEY\` | — | API token for authenticating with the server |
| \`RULEBOUND_ENFORCEMENT\` | \`advisory\` | Enforcement mode: \`advisory\`, \`moderate\`, \`strict\` |
| \`RULEBOUND_INJECT_RULES\` | \`true\` | Enable rule injection into prompts |
| \`RULEBOUND_SCAN_RESPONSES\` | \`true\` | Enable response scanning for violations |
| \`RULEBOUND_AUDIT_LOG\` | \`true\` | Enable audit logging |
| \`RULEBOUND_PROJECT\` | — | Project identifier for server rule filtering |
| \`RULEBOUND_STACK\` | — | Comma-separated tech stack (e.g., \`typescript,react\`) |

### Target URLs

Override the default LLM provider URLs:

| Variable | Default |
|----------|---------|
| \`OPENAI_TARGET_URL\` | \`https://api.openai.com\` |
| \`ANTHROPIC_TARGET_URL\` | \`https://api.anthropic.com\` |
| \`GOOGLE_TARGET_URL\` | \`https://generativelanguage.googleapis.com\` |

### Configuration Interface

\`\`\`typescript
interface GatewayConfig {
  port: number
  ruleboundServerUrl?: string
  ruleboundApiKey?: string
  targets: {
    openai?: string
    anthropic?: string
    google?: string
  }
  enforcement: "advisory" | "moderate" | "strict"
  injectRules: boolean
  scanResponses: boolean
  auditLog: boolean
  project?: string
  stack?: string[]
}
\`\`\`

### Default Configuration

\`\`\`typescript
const DEFAULT_CONFIG = {
  port: 4000,
  targets: {
    openai: "https://api.openai.com",
    anthropic: "https://api.anthropic.com",
    google: "https://generativelanguage.googleapis.com",
  },
  enforcement: "advisory",
  injectRules: true,
  scanResponses: true,
  auditLog: true,
}
\`\`\`

### Example: Strict Enforcement with Server

\`\`\`bash
GATEWAY_PORT=4000 \\
RULEBOUND_SERVER_URL=https://rules.example.com \\
RULEBOUND_API_KEY=rb_abc123 \\
RULEBOUND_ENFORCEMENT=strict \\
RULEBOUND_STACK=typescript,react \\
npx rulebound-gateway
\`\`\`

### Example: Local-Only (No Server)

When no \`RULEBOUND_SERVER_URL\` is set, the gateway runs without server-side rules. Rule injection will be skipped since no rules are available to inject.

\`\`\`bash
GATEWAY_PORT=4000 \\
RULEBOUND_SCAN_RESPONSES=true \\
npx rulebound-gateway
\`\`\`

### Programmatic Usage

\`\`\`typescript
import { createProxy, loadGatewayConfig } from "@rulebound/gateway"
import { serve } from "@hono/node-server"

const config = loadGatewayConfig()
const app = createProxy(config)

serve({ fetch: app.fetch, port: config.port })
\`\`\`

### Request Flow

Non-chat requests (e.g., model listing, embeddings) are forwarded transparently without any rule processing. Only POST requests to chat/message endpoints trigger rule injection and response scanning.

> The gateway strips the provider prefix from the path before forwarding. For example, \`/openai/v1/chat/completions\` is forwarded to \`https://api.openai.com/v1/chat/completions\`.
`,
}

export default doc
