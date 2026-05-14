import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "gateway/overview",
  title: "Gateway Overview",
  description:
    "Rulebound Gateway — optional, advanced HTTP proxy that intercepts AI agent LLM calls to inject rules and scan responses. Most users should start with the CLI and MCP server first.",
  content: `## Gateway Overview

> **Optional, advanced.** The Rulebound Gateway is **not** part of the day-one happy path. Start with the CLI (\`rulebound check\`) and the MCP server. Add the gateway only if you need to intercept LLM provider calls outside your agent's own tool surface.

The Gateway is a transparent HTTP proxy that sits between AI coding agents and LLM providers (OpenAI, Anthropic, Google). It intercepts API calls to inject your project rules into prompts and scan responses for rule violations.

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

1. **Route Detection** — the gateway detects the LLM provider from the request path prefix.
2. **Rule Injection** — for chat/message endpoints, rules are injected into the system prompt.
3. **Forward Request** — the modified request is forwarded to the real LLM API.
4. **Response Scanning** — code blocks in the response are scanned for rule violations.
5. **Enforcement** — violations are handled based on the enforcement mode (advisory, moderate, strict).

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

- **Rule Injection** — automatically injects project rules into system prompts.
- **Response Scanning** — extracts and validates code blocks from LLM responses.
- **AST Analysis** — deep structural analysis of generated code using tree-sitter.
- **Streaming Support** — full SSE streaming support with end-of-stream scanning.
- **Rule Caching** — 60-second TTL cache for rules fetched from the server.
- **Multi-Provider** — OpenAI, Anthropic, and Google supported simultaneously.

### Enforcement Modes

| Mode | Behavior |
|------|----------|
| \`advisory\` | Appends violation warnings to the response. |
| \`moderate\` | Appends warnings and logs violations. |
| \`strict\` | Blocks responses with violations (returns HTTP 422). |

### Body-log discipline (\`DEBUG_FULL_BODIES\`)

The gateway intentionally avoids logging full request and response bodies by default — they may carry prompts, code, and secrets. The \`DEBUG_FULL_BODIES\` environment variable opts into verbose body logging for debugging.

Keep \`DEBUG_FULL_BODIES\` **off** in production and on shared environments. Turn it on only on a local workstation, only for the minimal time needed to debug, and clear the resulting logs afterwards.

### Health Check

\`\`\`bash
curl http://localhost:4000/health
# {"status":"ok","type":"gateway","version":"0.1.0"}
\`\`\`

### When to use the gateway vs CLI/MCP

- **Use the CLI** (\`rulebound check\`) for deterministic gating on the working tree and PRs. That is the canonical surface.
- **Use the MCP server** to give an agent in-loop access to deterministic and advisory tools.
- **Use the gateway** if you need to inject rules and scan responses outside the agent's own tool surface — e.g. you control the LLM provider endpoint but not the agent.

### Next Steps

- [Request Scanning](/docs/gateway/request-scanning) — how rules are injected.
- [Response Scanning](/docs/gateway/response-scanning) — how violations are detected.
- [AST Analysis](/docs/gateway/ast-analysis) — structural code analysis.
`,
}

export default doc
