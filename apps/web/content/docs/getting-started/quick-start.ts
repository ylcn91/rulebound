import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "getting-started/quick-start",
  title: "Quick Start",
  description:
    "Get Rulebound running in your project in under 5 minutes. Initialize rules, validate a plan, and generate agent configs.",
  content: `## Quick Start

Get Rulebound enforcing your engineering standards in 5 minutes.

### 1. Install

\`\`\`bash
npm install -g rulebound
# or
pnpm add -g rulebound
\`\`\`

### 2. Initialize

Run \`init\` in your project root. This creates \`.rulebound/rules/\` with a starter rule and installs a pre-commit hook.

\`\`\`bash
cd your-project
rulebound init
\`\`\`

To include example rules:

\`\`\`bash
rulebound init --examples
\`\`\`

> Skip the pre-commit hook with \`rulebound init --no-hook\`.

### 3. Add a Rule

Create a markdown file in \`.rulebound/rules/\`. Use YAML front matter for metadata:

\`\`\`markdown
---
title: No Hardcoded Secrets
category: security
severity: error
modality: must
tags: [secrets, credentials]
stack: [typescript, javascript]
scope: [backend, api]
---

# No Hardcoded Secrets

API keys, passwords, and tokens must never be committed to source code.

## Rules

- Use environment variables for all secrets
- Never commit .env files
- Use a secrets manager in production
\`\`\`

### 4. Validate a Plan

Check an implementation plan against your rules:

\`\`\`bash
rulebound validate --plan "Add a payment endpoint that stores API keys in config.ts"
\`\`\`

Or validate from a file:

\`\`\`bash
rulebound validate --file plan.md
\`\`\`

### 5. Generate Agent Configs

Export your rules to agent-specific config files:

\`\`\`bash
# Generate for all agents (Claude Code, Cursor, Copilot)
rulebound generate

# Generate for a specific agent
rulebound generate --agent claude-code
\`\`\`

This creates:
- \`CLAUDE.md\` for Claude Code
- \`.cursor/rules.md\` for Cursor
- \`.github/copilot-instructions.md\` for GitHub Copilot

### 6. Check Your Diff

Before committing, validate your changes:

\`\`\`bash
rulebound diff
\`\`\`

The pre-commit hook does this automatically if installed.

### Next Steps

- [Rule Format](/docs/rules/rule-format) -- Learn the full rule YAML schema
- [CLI Reference](/docs/cli/overview) -- Explore all commands
- [Enforcement Modes](/docs/enforcement/overview) -- Configure how strictly rules are enforced
- [CI/CD Setup](/docs/enforcement/ci-cd) -- Add Rulebound to your pipeline
`,
}

export default doc
