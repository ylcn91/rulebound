# Rulebound

[![Rulebound Score](https://img.shields.io/badge/rulebound-93%25-4c1?style=flat-square)](https://github.com/ylcn91/rulebound)
[![MIT License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-310%20passing-brightgreen?style=flat-square)]()

Centralized rules for AI coding agents. Define your team's standards once — enforce them on every AI-generated line of code.

Works with **Claude Code**, **Cursor**, **GitHub Copilot**, and any AI coding agent.

## Architecture Overview

```
  Developer ──► AI Agent ──► Rulebound Gateway ──► LLM API
                  │                 │
                  │          ┌──────┴──────┐
                  │          │  Validation  │
                  │          │   Engine     │
                  │          │             │
                  │          │ • Keyword   │
                  │          │ • Semantic  │
                  │          │ • LLM      │
                  │          │ • AST      │
                  │          └──────┬──────┘
                  │                 │
                  │  ┌──────────────┼───────────────┐
                  │  │              │               │
                  │  Dashboard   Audit Log    Notifications
                  │  (Next.js)  (PostgreSQL)  (Slack/Teams/
                  │                            Discord/PD)
                  │
          ┌───────┼───────┐
          │       │       │
     LSP Server   │  MCP Server
    (IDE inline   │  (AI agent
     diagnostics) │   enforcement)
                  │
             CLI Watch
           (real-time
            monitoring)
```

**8 packages** · **310 tests** · **10 languages** · **36 AST queries** · **6 SDKs**

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture documentation with ASCII flow diagrams.

## The Problem

Your AI coding agents don't know your rules. They generate fast code — not *your* code. Standards live in scattered `.cursor/rules.md` and `CLAUDE.md` files across repos, and half the time agents ignore them anyway.

Rulebound fixes this.

## How It Works

1. **Define rules** as markdown files in `.rulebound/rules/`
2. **Find relevant rules** for any task with `rulebound find-rules --task "..."`
3. **Validate plans** before implementation with `rulebound validate --plan "..."`
4. **Inject rules** into your AI agent's context with `--format inject`

Rules are local, version-controlled, and portable. No server required.

## Install

```bash
npm install -g @rulebound/cli
```

Or with pnpm:

```bash
pnpm add -g @rulebound/cli
```

## Quick Start

```bash
# Initialize rules in your project
rulebound init --examples

# List all rules
rulebound rules list

# Find rules for a task
rulebound find-rules --task "add user authentication with JWT"

# Validate a plan against rules
rulebound validate --plan "I will add JWT auth with localStorage tokens"

# Show a specific rule
rulebound rules show "security.authentication-authorization"

# Output rules for AI agent injection
rulebound find-rules --task "add auth" --format inject
```

## Rule Format

Rules are markdown files with YAML front matter:

```markdown
---
title: No Hardcoded Secrets
category: security
severity: error
modality: must
tags: [secrets, env, credentials]
---

# No Hardcoded Secrets

All secrets MUST be loaded from environment variables.

## Rules

- Never hardcode API keys in source files
- Use `.env` files for local development
- Use a secrets manager in production

## Good Example

\```typescript
const apiKey = process.env.STRIPE_API_KEY;
\```

## Bad Example

\```typescript
const apiKey = "sk_live_abc123...";
\```
```

### Front Matter Fields

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `title` | Yes | string | Human-readable rule name |
| `category` | Yes | `architecture`, `security`, `style`, `testing`, `performance`, `documentation`, `accessibility`, `infra`, `workflow` | Rule domain |
| `severity` | Yes | `error`, `warning`, `info` | How critical the rule is |
| `modality` | Yes | `must`, `should`, `may` | Enforcement level (RFC 2119) |
| `tags` | No | string[] | Keywords for search matching |
| `stack` | No | string[] | Tech stack filter (e.g., `[java, spring-boot]`, `[typescript]`, `[docker]`) |
| `scope` | No | string[] | Project scope filter (e.g., `[backend, api]`, `[infra]`) |

### Modality (RFC 2119)

- **MUST** — Mandatory. Violation fails validation.
- **SHOULD** — Recommended. Violation warns.
- **MAY** — Optional. Informational only.

## Directory Structure

```
your-project/
├── .rulebound/
│   ├── config.json          # Project config (optional)
│   ├── agents.json          # Agent profiles for multi-agent review (optional)
│   └── rules/
│       ├── global/
│       │   ├── error-handling.md
│       │   ├── no-hardcoded-secrets.md
│       │   ├── testing-requirements.md
│       │   └── code-review-standards.md
│       ├── typescript/
│       │   ├── strict-types.md
│       │   └── zod-validation.md
│       ├── java-spring/
│       │   ├── dependency-injection.md
│       │   ├── exception-handling.md
│       │   ├── dto-pattern.md
│       │   ├── hexagonal-architecture.md
│       │   ├── testcontainers-setup.md
│       │   ├── archunit-enforcement.md
│       │   └── integration-test-requirements.md
│       ├── security/
│       │   ├── input-sanitization.md
│       │   └── authentication-authorization.md
│       ├── infra/
│       │   ├── kubernetes-resource-limits.md
│       │   ├── docker-no-latest-tag.md
│       │   ├── use-existing-dockerfile.md
│       │   └── redis-connection-pool.md
│       └── workflow/
│           ├── git-author-identity.md
│           └── branch-naming.md
```

## Example Rules

The `examples/rules/` directory includes production-ready rules for:

- **Global** -- Error handling, secrets, testing, code review
- **TypeScript** -- Strict types, Zod validation
- **Java/Spring Boot** -- DI, DTOs, exception handling, hexagonal architecture, Testcontainers, ArchUnit, integration tests
- **Go** -- Error handling, struct validation
- **React** -- Server Components
- **Security** -- Input sanitization, authentication & authorization
- **Infra** -- Kubernetes resource limits, Docker tag pinning, Dockerfile reuse, Redis connection pooling
- **Workflow** -- Git author identity, branch naming

Copy them to your project:

```bash
rulebound init --examples
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `rulebound init` | Create `.rulebound/rules/` directory and config |
| `rulebound generate` | Generate CLAUDE.md, .cursor/rules.md, copilot-instructions.md |
| `rulebound find-rules` | Search rules by task, category, tags, or stack |
| `rulebound validate` | Validate a plan against matched rules |
| `rulebound diff` | Validate git diff against rules |
| `rulebound score` | Calculate compliance score (0-100) + generate badge |
| `rulebound hook` | Install/remove pre-commit git hook |
| `rulebound enforce` | View or update enforcement mode (advisory, moderate, strict) |
| `rulebound ci` | Validate PR changes in CI/CD pipeline |
| `rulebound review` | Multi-agent review with consensus |
| `rulebound check-code` | AST-based code analysis (tree-sitter, 10 languages) |
| `rulebound watch` | Real-time file monitoring with live AST + rule validation |
| `rulebound agents list` | List configured agent profiles |
| `rulebound rules list` | List all rules |
| `rulebound rules show <id>` | Show rule detail |
| `rulebound rules lint` | Score rules on Quality Attributes (Atomicity, Completeness, Clarity) |
| `rulebound rules history <id>` | Show version history of a rule (git-based) |

### Find Rules Options

```
--task <text>       Describe the task to find relevant rules
--title <title>     Search by title keyword
--category <cat>    Filter by category
--tags <tags>       Filter by tags (comma-separated)
--stack <stack>     Filter by tech stack (comma-separated)
--format <fmt>      Output: table (default), json, inject
--dir <path>        Custom rules directory
```

### Validate Options

```
--plan <text>       Plan text to validate
--file <path>       Path to plan file (.md or .txt)
--format <fmt>      Output: pretty (default), json
--dir <path>        Custom rules directory
--llm               Use LLM for deep validation (requires AI SDK)
```

### Enforce Options

```
--mode <mode>       Set enforcement mode: advisory, moderate, strict
--threshold <n>     Set score threshold (0-100)
```

### CI Options

```
--base <branch>     Base branch to diff against (default: main)
--format <fmt>      Output: pretty (default), json, github
--llm               Use LLM for deep validation
--dir <path>        Custom rules directory
```

### Review Options

```
--agents <agents>   Comma-separated agent names
--plan <text>       Plan text to review
--diff              Review current git diff
--llm               Use LLM for deep validation
--dir <path>        Custom rules directory
```

### Watch Options

```
--debounce <ms>     Debounce delay in milliseconds (default: 300)
--format <fmt>      Output: pretty (default), json
--ignore <dirs>     Comma-separated directories to ignore (default: node_modules, .git, dist, .next, coverage)
```

Monitor files in real-time and get instant feedback on rule violations:

```bash
# Watch current directory
rulebound watch

# Watch with JSON output
rulebound watch --format json

# Custom debounce and ignores
rulebound watch --debounce 500 --ignore node_modules,.git,dist,build
```

## Generate Agent Configs

The killer feature. One command generates config files for every AI coding agent:

```bash
rulebound generate
```

This creates:
- `CLAUDE.md` — for Claude Code
- `.cursor/rules.md` — for Cursor
- `.github/copilot-instructions.md` — for GitHub Copilot

All from the same rule source. One set of rules, every agent.

```bash
# Generate for a specific agent only
rulebound generate --agent claude-code

# Custom output directory
rulebound generate --output ./my-project
```

## Diff Validation

Validate your git changes against rules before committing:

```bash
rulebound diff
rulebound diff --ref main
rulebound diff --format json
rulebound diff --llm
```

## Pre-Commit Hook

Auto-validate on every commit:

```bash
rulebound hook           # install
rulebound hook --remove  # uninstall
```

## Compliance Score

Get a score (0-100) and a badge for your README:

```bash
rulebound score
```

Output:
```
Score: 93/100
Rules: 14
Grade: A
```

Generates a shields.io badge you can paste into your README.

## Rule Inheritance

Share base rules across projects. In `.rulebound/config.json`:

```json
{
  "extends": ["../shared-rules/.rulebound/rules", "@company/rules"],
  "rulesDir": ".rulebound/rules"
}
```

Base rules are loaded first. Local rules with the same ID override inherited ones. This lets you define company-wide standards and override per-project.

## Rule Quality Scoring

Score your rules on three quality attributes:

```bash
rulebound rules lint
```

- **Atomicity** (0-5): One rule, one concern. Keep bullet points under 5.
- **Completeness** (0-5): Title + content + examples + tags + good/bad examples.
- **Clarity** (0-5): Active voice, specific language (MUST/NEVER), no vague words.

## Rule Versioning

Rules are version-controlled via git. View history:

```bash
rulebound rules history "global.error-handling"
```

Shows commit history, authors, and diff stats for any rule file.

## Enforcement Modes

Control how strictly Rulebound blocks commits and CI:

```bash
# View current enforcement config
rulebound enforce

# Set enforcement mode
rulebound enforce --mode strict
rulebound enforce --threshold 80
```

Three modes:
- **advisory** -- Never blocks. Reports violations as warnings.
- **moderate** -- Blocks on MUST violations and low scores.
- **strict** -- Blocks on any violation.

Configuration is stored in `.rulebound/config.json` under the `enforcement` key.

## CI/CD Integration

Validate PR changes in your CI pipeline:

```bash
# Basic CI validation
rulebound ci

# Against a specific base branch
rulebound ci --base develop

# GitHub Actions annotations
rulebound ci --format github

# With LLM-powered deep validation
rulebound ci --llm
```

Add to your GitHub Actions workflow:

```yaml
- name: Rulebound CI
  run: npx rulebound ci --base main --format github
```

Exit codes: `0` = passed, `1` = blocked/failed, `2` = config error.

## Multi-Agent Review

Run validation through multiple agent profiles with consensus:

```bash
# Review with all configured agents
rulebound review --plan "Add REST API with JWT auth"

# Review current git diff
rulebound review --diff

# Specific agents only
rulebound review --agents "security-agent,arch-agent" --plan "..."
```

Agent profiles are defined in `.rulebound/agents.json`. Each agent has roles, rule scopes, and enforcement levels. The review command builds a consensus across all agents.

## MCP Server

Rulebound includes an MCP (Model Context Protocol) server that lets AI agents query and validate against project rules in real-time.

### Setup

```json
{
  "mcpServers": {
    "rulebound": {
      "command": "npx",
      "args": ["-y", "@rulebound/mcp"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `find_rules` | Find relevant rules for a task (auto-detects project stack) |
| `validate_plan` | Validate an implementation plan against matched rules |
| `check_code` | Check a code snippet against relevant rules |
| `list_rules` | List all available rules for the project's stack |
| `validate_before_write` | Pre-write enforcement -- validates code before writing to file (AST + semantic) |

The MCP server auto-detects the project's tech stack from files like `pom.xml`, `package.json`, `go.mod`, etc., and filters rules accordingly.

## AST Code Analysis

Rulebound includes a WASM-based AST analyzer powered by [tree-sitter](https://tree-sitter.github.io/). It parses actual source files and detects structural anti-patterns — no regex, no heuristics.

```bash
rulebound check-code --file src/service.ts
```

```
AST CODE ANALYSIS
────────────────────────────────────────────────────────────
File:     src/service.ts
Language: typescript
Nodes:    146
Parse:    16ms
Query:    44ms
────────────────────────────────────────────────────────────

  ERROR No 'any' Type (ts-no-any)
         Use 'unknown' with type guards instead of 'any'
         L1:15 any
         Fix: Replace 'any' with 'unknown' and add type narrowing

  ERROR No eval() (ts-no-eval)
         eval() is a security risk and should never be used
         L7:5 eval("some code")
         Fix: Use JSON.parse(), new Function(), or refactor logic

────────────────────────────────────────────────────────────
  2 error(s) in 2 finding(s)
```

### Supported Languages

| Language   | Queries | Key Detections                                        |
|------------|---------|-------------------------------------------------------|
| TypeScript | 10      | `any`, `eval`, `console.log`, `debugger`, empty catch, `var`, non-null assertion, type assertion, nested ternary, `alert` |
| JavaScript | 7       | Same as TS minus TS-specific checks                    |
| Python     | 7       | `eval`, `exec`, `print`, bare except, `pass` in except, mutable default args, `import *` |
| Java       | 5       | `@Autowired` field injection, `System.out.println`, `Thread.sleep`, `catch(Throwable)`, empty catch |
| Go         | 3       | `fmt.Println`, `panic()`, unchecked errors             |
| Rust       | 4       | `unwrap()`, `expect()`, `println!`/`dbg!`, `todo!()`  |

### Options

```bash
rulebound check-code --file <path>           # Auto-detect language
rulebound check-code --file <path> -l python # Override language
rulebound check-code --file <path> -q ts-no-eval,ts-no-any  # Run specific queries
```

## LLM Gateway

The gateway is a transparent HTTP proxy that sits between your AI tools and LLM APIs. It intercepts every request to enforce rules in real-time.

```bash
# Set your AI tool to use the gateway
export OPENAI_API_BASE=http://localhost:4000/openai/v1
```

**How it works:**
1. AI tool sends request to gateway (thinks it's talking to OpenAI)
2. Gateway loads project rules, injects them into the system prompt
3. Request forwarded to real LLM API
4. Response comes back, gateway scans code blocks for violations
5. AST analysis runs on detected code blocks (language auto-detected from annotations)
6. Advisory mode: appends warnings. Strict mode: blocks with 422.

Supports **OpenAI**, **Anthropic**, and **Google** API formats. Handles both regular and SSE streaming responses. The gateway includes a built-in AST scanner that detects code fence annotations (e.g., `` ```typescript ``) and runs tree-sitter analysis on the extracted code blocks.

## LSP Server

Rulebound includes an LSP (Language Server Protocol) server that provides inline diagnostics directly in your IDE. It runs both AST analysis and rule validation on every file change.

### Setup

#### VS Code

Add to your `.vscode/settings.json`:

```json
{
  "rulebound.lsp.enabled": true
}
```

Or run the LSP server manually:

```bash
npx @rulebound/lsp --stdio
```

### Features

- **Real-time diagnostics** -- AST violations and rule violations appear as you type
- **Debounced analysis** -- 300ms debounce to avoid unnecessary re-analysis
- **Workspace-aware** -- Automatically loads rules from `.rulebound/rules/` in your workspace
- **Multi-language** -- Supports all 10 tree-sitter languages (TypeScript, JavaScript, Python, Java, Go, Rust, C#, C++, Ruby, Bash)
- **On-save analysis** -- Full re-analysis on every file save

## Enterprise Server API

Full HTTP API for centralized rule management, validation, and compliance tracking.

```
POST /v1/validate          Real-time code validation (uses engine)
GET  /v1/rules             List rules with versioning
POST /v1/rules             Create rule
GET  /v1/sync              Pull latest rules (centralized sync)
GET  /v1/audit             Query audit log
GET  /v1/compliance/:id    Compliance score + trend
POST /v1/webhooks/endpoints Register outbound webhook
POST /v1/webhooks/in       Inbound webhooks (GitHub/GitLab)
```

### Notifications

Built-in notification routing to 4 providers:

| Provider  | Format      | Events                     |
|-----------|-------------|----------------------------|
| Slack     | Block Kit   | violation.detected, compliance.score_changed, rule.updated |
| MS Teams  | MessageCard | Same as above              |
| Discord   | Embeds      | Same as above              |
| PagerDuty | Events v2   | violation.detected (critical) |

## SDKs

Client libraries for 6 languages. All share the same API surface:

```python
# Python
from rulebound import RuleboundClient

client = RuleboundClient("http://localhost:3001", api_key="rb_your_token")
result = client.validate(code="const x: any = 5;", rules=["ts-no-any"])
print(result.status)  # "FAILED"
```

```go
// Go
client := rulebound.NewClient("http://localhost:3001", "rb_your_token")
result, _ := client.Validate(ctx, rulebound.ValidateRequest{
    Code: "const x: any = 5;",
})
```

```typescript
// TypeScript
const client = new RuleboundClient("http://localhost:3001", "rb_your_token");
const result = await client.validate({ code: "const x: any = 5;" });
```

Available: **Python** (httpx) · **Go** (stdlib) · **TypeScript** (fetch) · **Java** (HttpClient) · **C#/.NET** (HttpClient) · **Rust** (reqwest)

## Dashboard

Web-based dashboard for compliance monitoring:

- **Overview** -- Compliance score ring, project stats, top violations, activity feed
- **Rules** -- Browse, search, and create rules with syntax-highlighted preview
- **Projects** -- Project listing with stack detection and compliance scores
- **Audit Log** -- Filterable table of all validation events
- **Compliance** -- Sparkline trend charts, progress bars per project
- **Webhooks** -- Endpoint management, delivery history, test sending
- **Import** -- Import rules from external sources
- **Settings** -- Project and organization configuration

## Using with AI Agents

### Claude Code

Add to your `CLAUDE.md`:

```markdown
Before implementing any task, run:
\```
rulebound find-rules --task "<task description>" --format inject
\```
Include the output rules in your implementation context.

Before finalizing, validate your plan:
\```
rulebound validate --plan "<your implementation plan>"
\```
```

### Cursor

Add to `.cursor/rules.md`:

```markdown
For every task, first check project rules:
rulebound find-rules --task "{task}" --format inject

Validate before implementation:
rulebound validate --plan "{plan}"
```

### GitHub Copilot

Use the CLI in your CI/CD pipeline:

```yaml
- name: Validate AI Plan
  run: rulebound validate --file plan.md
```

## Development

### Prerequisites

- **Node.js** 22+
- **pnpm** 10+
- **PostgreSQL** 17 (only for web dashboard — CLI works without it)

### CLI Only (no database needed)

```bash
git clone https://github.com/ylcn91/rulebound.git
cd rulebound
pnpm install
pnpm --filter @rulebound/cli build
node packages/cli/dist/index.js --help
```

### Web Dashboard (requires PostgreSQL)

```bash
# Create database
createdb rulebound

# Copy env and set your DATABASE_URL
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local: DATABASE_URL=postgresql://user:pass@localhost:5432/rulebound

# Push schema
pnpm --filter web db:push

# Start dev server
pnpm --filter web dev
```

### Tech Stack

- **CLI:** TypeScript, Commander.js, Chalk
- **Engine:** TypeScript, web-tree-sitter (WASM AST parsing), tree-sitter-wasms (10 language grammars)
- **Gateway:** TypeScript, HTTP proxy with SSE stream interception, AST code block scanning
- **LSP Server:** TypeScript, vscode-languageserver, real-time AST + rule diagnostics
- **Server:** TypeScript, Hono (HTTP), Drizzle ORM, HMAC-SHA256 webhooks
- **MCP Server:** TypeScript, @modelcontextprotocol/sdk, Zod, pre-write enforcement
- **Shared:** TypeScript, common types and structured logger
- **Web:** Next.js 16, React 19, Tailwind CSS 4, Radix UI, Lucide Icons
- **Database:** PostgreSQL 17, Drizzle ORM
- **SDKs:** Python (httpx), Go (stdlib), TypeScript (fetch), Java (HttpClient), C#/.NET (HttpClient), Rust (reqwest)
- **Testing:** Vitest 4 (310 tests across 30 test files)
- **Monorepo:** Turborepo + pnpm workspaces

## Contributing

Contributions welcome. Open an issue or submit a PR.

1. Fork the repo
2. Create a branch (`git checkout -b feature/my-rule`)
3. Commit changes
4. Push and open a PR

## License

MIT License. See [LICENSE](LICENSE) for details.
