import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "gateway/overview",
  title: "Gateway Overview",
  description: "Rulebound Gateway — an HTTP proxy that intercepts AI agent API calls to inject rules and scan responses for violations.",
  content: `## Gateway Overview

The Rulebound Gateway is a transparent HTTP proxy that sits between your AI coding agents and LLM providers (OpenAI, Anthropic, Google). It intercepts API calls to inject your project rules into prompts and scan responses for rule violations.

### Architecture

\`\`\`
AI Agent  -->  Rulebound Gateway  -->  LLM Provider
                   |                       |
             Rule Injection           Response
             (pre-request)           Scanning
                   |               (post-response)
             Rule Cache  <---  Rulebound Server
\`\`\`

The gateway is built on [Hono](https://hono.dev) and runs as a lightweight Node.js HTTP server. It supports three LLM providers out of the box:

| Provider | Route Prefix | Target |
|----------|-------------|--------|
| OpenAI | \`/openai/v1\` | \`api.openai.com\` |
| Anthropic | \`/anthropic\` | \`api.anthropic.com\` |
| Google | \`/google\` | \`generativelanguage.googleapis.com\` |

### How It Works

1. **Route Detection** — The gateway detects the LLM provider from the request path prefix
2. **Rule Injection** — For chat/message endpoints, rules are injected into the system prompt
3. **Forward Request** — The modified request is forwarded to the real LLM API
4. **Response Scanning** — Code blocks in the response are scanned for rule violations
5. **Enforcement** — Violations are handled based on the enforcement mode (advisory, moderate, strict)

### Quick Start

\`\`\`bash
# Install
pnpm add @rulebound/gateway

# Start the gateway
GATEWAY_PORT=4000 npx rulebound-gateway
\`\`\`

Configure your AI tools to route through the gateway:

\`\`\`bash
# OpenAI-compatible tools
export OPENAI_API_BASE=http://localhost:4000/openai/v1

# Anthropic-compatible tools
export ANTHROPIC_API_BASE=http://localhost:4000/anthropic
\`\`\`

### Features

- **Rule Injection** — Automatically injects project rules into system prompts
- **Response Scanning** — Extracts and validates code blocks from LLM responses
- **AST Analysis** — Deep structural analysis of generated code using tree-sitter
- **Streaming Support** — Full SSE streaming support with end-of-stream scanning
- **Rule Caching** — 60-second TTL cache for rules fetched from the server
- **Multi-Provider** — OpenAI, Anthropic, and Google supported simultaneously

### Enforcement Modes

| Mode | Behavior |
|------|----------|
| \`advisory\` | Appends violation warnings to the response |
| \`moderate\` | Appends warnings and logs violations |
| \`strict\` | Blocks responses with violations (returns HTTP 422) |

### Health Check

\`\`\`bash
curl http://localhost:4000/health
# {"status":"ok","type":"gateway","version":"0.1.0"}
\`\`\`

### Next Steps

- [Configuration](/docs/gateway/request-scanning) — Configure rule injection
- [Response Scanning](/docs/gateway/response-scanning) — How violations are detected
- [AST Analysis](/docs/gateway/ast-analysis) — Structural code analysis
`,
}

export default doc
