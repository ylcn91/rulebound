import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/overview",
  title: "CLI Overview",
  description:
    "Rulebound CLI reference -- all commands for rule management, validation, code analysis, and enforcement.",
  content: `## CLI Overview

The Rulebound CLI provides commands for every stage of rule enforcement: initialization, discovery, validation, generation, and CI/CD integration.

### Installation

\`\`\`bash
npm install -g rulebound
\`\`\`

### Usage

\`\`\`bash
rulebound <command> [options]
\`\`\`

### Commands

| Command | Description |
|---------|-------------|
| \`init\` | Initialize \`.rulebound/\` with rules directory, config, and pre-commit hook |
| \`find-rules\` | Find and filter rules by task, category, tags, or stack |
| \`validate\` | Validate a plan or file against matched rules |
| \`generate\` | Generate agent config files (CLAUDE.md, .cursor/rules.md, copilot-instructions.md) |
| \`diff\` | Validate git diff against rules before merge |
| \`score\` | Calculate rule quality score and generate a badge |
| \`hook\` | Install or remove the pre-commit git hook |
| \`enforce\` | View or update enforcement mode (advisory, moderate, strict) |
| \`ci\` | Validate PR changes in CI/CD pipelines with GitHub Actions annotations |
| \`check-code\` | Analyze source files with AST-based anti-pattern detection (tree-sitter) |
| \`watch\` | Watch files for changes and run real-time rule + AST validation |
| \`rules list\` | List all rules with metadata |
| \`rules show <id>\` | Show full detail of a single rule |
| \`rules lint\` | Score rules on quality (atomicity, completeness, clarity) |
| \`rules history <id>\` | Show git-based version history of a rule |
| \`review\` | Multi-agent review with consensus |

### Global Options

| Flag | Description |
|------|-------------|
| \`--version\` | Print version number |
| \`--help\` | Show help for any command |

### Common Options

Most commands accept these options:

| Flag | Description |
|------|-------------|
| \`-d, --dir <path>\` | Path to rules directory (overrides config) |
| \`-f, --format <type>\` | Output format (pretty, json, github, inject) |
| \`--llm\` | Use LLM for deep validation (requires AI SDK) |

### Workflow Example

\`\`\`bash
# 1. Initialize
rulebound init --examples

# 2. Edit config
vim .rulebound/config.json

# 3. Add rules
vim .rulebound/rules/security/no-secrets.md

# 4. Check rule quality
rulebound score

# 5. Validate a plan
rulebound validate --plan "Add payment processing endpoint"

# 6. Generate agent configs
rulebound generate --agent claude-code

# 7. Check diff before commit
rulebound diff

# 8. Run in CI
rulebound ci --base main --format github
\`\`\`
`,
}

export default doc
