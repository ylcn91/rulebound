# Rulebound

Centralized rules for AI coding agents. Define your team's standards once — enforce them on every AI-generated line of code.

Works with **Claude Code**, **Cursor**, **GitHub Copilot**, and any AI coding agent.

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
| `category` | Yes | `architecture`, `security`, `style`, `testing`, `performance`, `documentation`, `accessibility` | Rule domain |
| `severity` | Yes | `error`, `warning`, `info` | How critical the rule is |
| `modality` | Yes | `must`, `should`, `may` | Enforcement level (RFC 2119) |
| `tags` | No | string[] | Keywords for search matching |

### Modality (RFC 2119)

- **MUST** — Mandatory. Violation fails validation.
- **SHOULD** — Recommended. Violation warns.
- **MAY** — Optional. Informational only.

## Directory Structure

```
your-project/
├── .rulebound/
│   ├── config.json          # Project config (optional)
│   └── rules/
│       ├── global/
│       │   ├── error-handling.md
│       │   ├── no-hardcoded-secrets.md
│       │   └── testing-requirements.md
│       ├── typescript/
│       │   ├── strict-types.md
│       │   └── zod-validation.md
│       ├── java-spring/
│       │   ├── dependency-injection.md
│       │   └── exception-handling.md
│       └── security/
│           ├── input-sanitization.md
│           └── authentication.md
```

## Example Rules

The `examples/rules/` directory includes production-ready rules for:

- **Global** — Error handling, secrets, testing, code review
- **TypeScript** — Strict types, Zod validation
- **Java/Spring Boot** — DI, DTOs, exception handling
- **Go** — Error handling, struct validation
- **React** — Server Components
- **Security** — Input sanitization, authentication

Copy them to your project:

```bash
rulebound init --examples
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `rulebound init` | Create `.rulebound/rules/` directory |
| `rulebound rules list` | List all rules |
| `rulebound rules show <id>` | Show rule detail |
| `rulebound rules lint` | Score rules on Quality Attributes (Atomicity, Completeness, Clarity) |
| `rulebound rules history <id>` | Show version history of a rule (git-based) |
| `rulebound find-rules` | Search rules by task, category, or tags |
| `rulebound validate` | Validate a plan against all rules |

### Find Rules Options

```
--task <text>       Describe the task to find relevant rules
--title <title>     Search by title keyword
--category <cat>    Filter by category
--tags <tags>       Filter by tags (comma-separated)
--format <fmt>      Output: table (default), json, inject
--dir <path>        Custom rules directory
```

### Validate Options

```
--plan <text>       Plan text to validate
--file <path>       Path to plan file (.md or .txt)
--dir <path>        Custom rules directory
```

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
- **Web:** Next.js 16, React 19, Tailwind CSS 4, Drizzle ORM
- **Database:** PostgreSQL 17
- **Monorepo:** Turborepo + pnpm

## Contributing

Contributions welcome. Open an issue or submit a PR.

1. Fork the repo
2. Create a branch (`git checkout -b feature/my-rule`)
3. Commit changes
4. Push and open a PR

## License

MIT License. See [LICENSE](LICENSE) for details.
