import type { DocPage } from "./registry"

const doc: DocPage = {
  slug: "getting-started/introduction",
  title: "Introduction",
  description:
    "Rulebound is an open-source rule enforcement platform for AI coding agents. Define rules once, enforce everywhere.",
  content: `## What is Rulebound?

Rulebound is an open-source platform that lets teams define engineering standards as structured rules and enforce them across AI coding agents. Write your rules as markdown files with YAML front matter, and Rulebound validates every plan, diff, and generated code snippet against them.

Instead of hoping your AI agent follows instructions buried in a long prompt, Rulebound gives you a systematic way to declare, validate, and enforce your standards.

## Key Features

- **Rule-as-code** -- Define rules as markdown files with YAML metadata (severity, modality, category, tags, stack, scope)
- **Multi-agent support** -- Generate config files for Claude Code, Cursor, and GitHub Copilot from a single rule set
- **Validation pipeline** -- Three-layer matching: keyword, semantic, and optional LLM-based deep validation
- **Git integration** -- Pre-commit hooks and diff validation catch violations before they land
- **CI/CD enforcement** -- Run \`rulebound ci\` in your pipeline with GitHub Actions annotations
- **AST analysis** -- Tree-sitter powered anti-pattern detection across 10+ languages
- **Real-time watch mode** -- Monitor file changes and validate on save
- **Quality scoring** -- Score your rules on atomicity, completeness, and clarity
- **Rule inheritance** -- Share base rule sets across projects via \`extends\`
- **Enforcement modes** -- Advisory, moderate, or strict blocking with configurable thresholds

## Architecture Overview

Rulebound is a monorepo with these core packages:

| Package | Description |
|---------|-------------|
| \`@rulebound/cli\` | Command-line interface for all operations |
| \`@rulebound/engine\` | Validation pipeline, rule loader, AST analysis |
| \`@rulebound/shared\` | Shared types and utilities |
| \`@rulebound/gateway\` | HTTP gateway for server-side validation |
| \`@rulebound/lsp\` | Language Server Protocol diagnostics |
| \`@rulebound/mcp\` | Model Context Protocol server for pre-write enforcement |

### How It Works

1. **Define** -- Write rules as markdown with YAML front matter in \`.rulebound/rules/\`
2. **Match** -- Rulebound finds relevant rules based on task context, stack, scope, and tags
3. **Validate** -- A multi-layer pipeline (keyword + semantic + optional LLM) checks compliance
4. **Enforce** -- Violations block commits, fail CI, or surface as warnings depending on enforcement mode
5. **Generate** -- Export rules to agent-specific config files so AI follows them proactively

## Next Steps

- [Quick Start](/docs/getting-started/quick-start) -- Get running in 5 minutes
- [Installation](/docs/getting-started/installation) -- Detailed setup instructions
- [Rule Format](/docs/rules/rule-format) -- How to write rules
- [CLI Reference](/docs/cli/overview) -- All available commands
- [CI/CD Integration](/docs/enforcement/ci-cd) -- Pipeline setup
`,
}

export default doc
