import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "getting-started/project-structure",
  title: "Project Structure",
  description:
    "Understand the Rulebound directory structure, rule organization, and monorepo layout.",
  content: `## Project Structure

After running \`rulebound init\`, your project will contain these Rulebound files:

\`\`\`
your-project/
  .rulebound/
    config.json          # Project configuration
    rules/
      global/
        example-rule.md  # Starter rule
      security/          # Organize by category
        no-secrets.md
      style/
        naming.md
  .git/
    hooks/
      pre-commit         # Auto-installed hook
\`\`\`

### Directory Layout

| Path | Purpose |
|------|---------|
| \`.rulebound/\` | Root directory for all Rulebound configuration |
| \`.rulebound/config.json\` | Project config (stack, scope, team, extends, enforcement) |
| \`.rulebound/rules/\` | Your rule files, organized by category subdirectories |

### Rule Organization

Rules are markdown files with YAML front matter. You can organize them however you like inside \`.rulebound/rules/\`:

\`\`\`
.rulebound/rules/
  global/           # Rules that apply to all code
    error-handling.md
    naming.md
  security/         # Security-specific rules
    no-secrets.md
    input-validation.md
  testing/          # Testing standards
    coverage.md
    test-naming.md
  architecture/     # Architecture decisions
    api-patterns.md
\`\`\`

Subdirectory names are used as the default \`category\` for rules that do not set one explicitly in their front matter.

### Rule IDs

Each rule gets an automatic ID derived from its file path relative to the rules directory:

| File Path | Rule ID |
|-----------|---------|
| \`global/error-handling.md\` | \`global.error-handling\` |
| \`security/no-secrets.md\` | \`security.no-secrets\` |
| \`testing/coverage.md\` | \`testing.coverage\` |

These IDs are used for inheritance overrides -- if a local rule has the same ID as an inherited rule, the local rule takes precedence.

### Generated Files

When you run \`rulebound generate\`, agent config files are created in your project root:

| File | Agent |
|------|-------|
| \`CLAUDE.md\` | Claude Code |
| \`.cursor/rules.md\` | Cursor |
| \`.github/copilot-instructions.md\` | GitHub Copilot |

> Commit these files so your AI agents automatically pick up your rules.

### Monorepo Structure

The Rulebound platform itself is organized as a Turborepo monorepo:

\`\`\`
rulebound/
  packages/
    cli/             # @rulebound/cli - Command-line interface
    engine/          # @rulebound/engine - Validation pipeline, AST
    shared/          # @rulebound/shared - Shared types
    gateway/         # @rulebound/gateway - HTTP proxy gateway
    lsp/             # @rulebound/lsp - Language Server Protocol
    mcp/             # @rulebound/mcp - Model Context Protocol
  apps/
    web/             # Documentation and marketing site
  examples/
    rules/           # Example rule sets
\`\`\`
`,
}

export default doc
