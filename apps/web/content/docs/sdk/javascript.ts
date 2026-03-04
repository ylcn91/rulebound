import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "sdk/javascript",
  title: "JavaScript SDK",
  description: "Using Rulebound packages programmatically — engine, gateway, server, LSP, and MCP as library dependencies.",
  content: `## JavaScript SDK

Rulebound is distributed as a set of npm packages that can be used programmatically. Each package serves a specific purpose and can be imported independently.

### Packages

| Package | Description | Install |
|---------|-------------|---------|
| \`@rulebound/engine\` | Core validation engine, AST analysis, rule loading | \`pnpm add @rulebound/engine\` |
| \`@rulebound/gateway\` | HTTP proxy for LLM API interception | \`pnpm add @rulebound/gateway\` |
| \`@rulebound/server\` | REST API server for centralized management | \`pnpm add @rulebound/server\` |
| \`@rulebound/lsp\` | Language Server Protocol server | \`pnpm add @rulebound/lsp\` |
| \`@rulebound/mcp\` | Model Context Protocol server | \`pnpm add @rulebound/mcp\` |
| \`@rulebound/shared\` | Shared types and logger | \`pnpm add @rulebound/shared\` |

### Engine API

The engine is the core package for rule loading, validation, and AST analysis.

#### Validation

\`\`\`typescript
import { validate } from "@rulebound/engine"

const report = await validate({
  plan: "Implementation plan or code...",
  rules: projectRules,
  task: "Build user authentication",
  useLlm: false,
})

console.log(report.status)  // "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED"
console.log(report.summary) // { pass: 5, violated: 1, notCovered: 2 }
\`\`\`

#### Rule Loading

\`\`\`typescript
import {
  findRulesDir,
  loadLocalRules,
  filterRules,
  loadConfig,
  loadRulesWithInheritance,
} from "@rulebound/engine"

// Find and load rules
const rulesDir = findRulesDir(process.cwd())
if (rulesDir) {
  const rules = loadLocalRules(rulesDir)

  // Filter by stack and category
  const filtered = filterRules(rules, {
    stack: "typescript",
    category: "security",
    task: "implement login",
  })
}
\`\`\`

#### AST Analysis

\`\`\`typescript
import {
  analyzeCode,
  analyzeWithBuiltins,
  getBuiltinQueries,
  listQueryIds,
} from "@rulebound/engine"

// Analyze with all built-in queries
const result = await analyzeWithBuiltins(code, "typescript")

// Analyze with specific query IDs
const result = await analyzeWithBuiltins(code, "typescript", [
  "ts-no-eval",
  "ts-no-any",
])

// Analyze with custom queries
const result = await analyzeCode(code, "typescript", [
  {
    id: "custom-no-todo",
    name: "No TODO comments",
    description: "Detect TODO comments",
    language: "typescript",
    severity: "warning",
    category: "style",
    query: \`(comment) @comment\`,
    message: "TODO comment found",
  },
])
\`\`\`

#### Enforcement

\`\`\`typescript
import { shouldBlock, shouldWarn, calculateScore } from "@rulebound/engine"

const score = calculateScore(report)

const blocked = shouldBlock({
  hasMustViolation: true,
  score: 65,
})
\`\`\`

### Gateway API

\`\`\`typescript
import { createProxy, loadGatewayConfig } from "@rulebound/gateway"
import { serve } from "@hono/node-server"

const config = loadGatewayConfig()
const app = createProxy(config)

serve({ fetch: app.fetch, port: config.port })
\`\`\`

#### Direct Scanning

\`\`\`typescript
import {
  scanResponse,
  extractCodeBlocks,
  buildViolationWarning,
  scanCodeBlockWithAST,
} from "@rulebound/gateway"

// Scan response text for violations
const result = await scanResponse(llmResponseText, rules)

// Extract code blocks manually
const blocks = extractCodeBlocks(text)

// Scan a single code block with AST
const violations = await scanCodeBlockWithAST(code, "typescript")
\`\`\`

### Server API

\`\`\`typescript
import { createApp } from "@rulebound/server"
import { serve } from "@hono/node-server"

const app = createApp()
serve({ fetch: app.fetch, port: 3001 })
\`\`\`

#### Individual Route Handlers

\`\`\`typescript
import {
  rulesApi,
  validateApi,
  auditApi,
  complianceApi,
  syncApi,
  webhooksApi,
  tokensApi,
} from "@rulebound/server"

// Mount individual handlers on your own Hono app
app.route("/rules", rulesApi)
app.route("/validate", validateApi)
\`\`\`

#### Notifications

\`\`\`typescript
import {
  NotificationManager,
  SlackNotifier,
  DiscordNotifier,
  violationNotification,
} from "@rulebound/server"

const manager = new NotificationManager()
manager.addProvider({
  type: "slack",
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  events: ["violation.detected"],
  enabled: true,
})

await manager.notify(violationNotification({
  ruleName: "No eval()",
  project: "my-app",
  severity: "error",
  reason: "eval() detected in generated code",
}))
\`\`\`

### Types

All packages export their TypeScript types:

\`\`\`typescript
import type {
  Rule,
  ValidationReport,
  ValidationResult,
  EnforcementMode,
  ASTMatch,
  ASTQueryDefinition,
  SupportedLanguage,
} from "@rulebound/engine"

import type {
  GatewayConfig,
  ScanResult,
  StreamScannerConfig,
} from "@rulebound/gateway"

import type {
  NotificationPayload,
  NotificationResult,
  WebhookEvent,
  WebhookPayload,
} from "@rulebound/server"
\`\`\`
`,
}

export default doc
