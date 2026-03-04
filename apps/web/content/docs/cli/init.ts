import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/init",
  title: "rulebound init",
  description:
    "Initialize Rulebound in your project with rules directory, config file, and optional pre-commit hook.",
  content: `## rulebound init

Initialize \`.rulebound/\` in your project with a rules directory, config file, starter rule, and pre-commit hook.

### Usage

\`\`\`bash
rulebound init [options]
\`\`\`

### Options

| Flag | Description |
|------|-------------|
| \`--examples\` | Copy example rules to get started |
| \`--no-hook\` | Skip pre-commit hook installation |

### What It Creates

| Path | Description |
|------|-------------|
| \`.rulebound/config.json\` | Project configuration template |
| \`.rulebound/rules/global/example-rule.md\` | Starter rule |
| \`.git/hooks/pre-commit\` | Pre-commit hook (if git repo exists) |

### Config Template

\`\`\`json
{
  "project": {
    "name": "",
    "stack": [],
    "scope": [],
    "team": ""
  },
  "extends": [],
  "rulesDir": ".rulebound/rules"
}
\`\`\`

### Pre-Commit Hook

The auto-installed hook runs \`rulebound diff --ref HEAD\` on every commit. If violations are found, the commit is blocked.

\`\`\`bash
# Skip the hook during init
rulebound init --no-hook

# Install/remove the hook separately
rulebound hook
rulebound hook --remove
\`\`\`

### Examples

\`\`\`bash
# Basic initialization
rulebound init

# With example rules
rulebound init --examples

# Without pre-commit hook
rulebound init --no-hook
\`\`\`

### Next Steps

After initialization:

1. Edit \`.rulebound/config.json\` with your project info (stack, scope, team)
2. Add rules as markdown files in \`.rulebound/rules/\`
3. Run \`rulebound rules list\` to verify
4. Run \`rulebound generate --agent claude-code\` to create agent configs
5. Run \`rulebound validate --plan "your plan"\` to test validation

> If the rules directory already exists, \`init\` will exit without overwriting.
`,
}

export default doc
