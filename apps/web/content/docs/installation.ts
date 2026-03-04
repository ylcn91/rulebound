import type { DocPage } from "./registry"

const doc: DocPage = {
  slug: "getting-started/installation",
  title: "Installation",
  description:
    "Install and configure Rulebound for your project. Supports npm, pnpm, and yarn.",
  content: `## Installation

### Global Install

Install Rulebound globally to use the \`rulebound\` command anywhere:

\`\`\`bash
# npm
npm install -g rulebound

# pnpm
pnpm add -g rulebound

# yarn
yarn global add rulebound
\`\`\`

### Project-Local Install

For team consistency, install as a dev dependency:

\`\`\`bash
# npm
npm install -D rulebound

# pnpm
pnpm add -D rulebound
\`\`\`

Then run with \`npx\`:

\`\`\`bash
npx rulebound init
\`\`\`

### Verify Installation

\`\`\`bash
rulebound --version
rulebound --help
\`\`\`

### Initialize Your Project

\`\`\`bash
rulebound init
\`\`\`

This creates:

| Path | Description |
|------|-------------|
| \`.rulebound/config.json\` | Project configuration (name, stack, scope, team) |
| \`.rulebound/rules/\` | Directory for your rule files |
| \`.rulebound/rules/global/example-rule.md\` | A starter rule to get you going |
| \`.git/hooks/pre-commit\` | Pre-commit hook (auto-installed if .git exists) |

### Options

\`\`\`bash
# Include example rules from the rulebound examples directory
rulebound init --examples

# Skip pre-commit hook installation
rulebound init --no-hook
\`\`\`

### Project Configuration

Edit \`.rulebound/config.json\` to describe your project:

\`\`\`json
{
  "project": {
    "name": "my-api",
    "stack": ["typescript", "express", "postgresql"],
    "scope": ["backend", "api"],
    "team": "platform"
  },
  "extends": [],
  "rulesDir": ".rulebound/rules"
}
\`\`\`

### Requirements

- **Node.js** 18+ (uses native ESM, fs.watch recursive)
- **Git** (for diff validation, hooks, and rule history)
- **pnpm / npm / yarn** (any package manager works)

### Optional Dependencies

For LLM-powered deep validation (\`--llm\` flag):

\`\`\`bash
pnpm add ai @ai-sdk/anthropic
# or
pnpm add ai @ai-sdk/openai
\`\`\`

Set your API key:

\`\`\`bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
\`\`\`
`,
}

export default doc
