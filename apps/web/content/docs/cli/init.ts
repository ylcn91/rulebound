import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/init",
  title: "rulebound init",
  description:
    "Initialize .rulebound/ in your project — rules directory, config, optional curated rule packs, and a pre-commit hook.",
  content: `## rulebound init

Initialize \`.rulebound/\` in your project: rules directory, config file, optional curated rule packs, and (by default) a pre-commit hook.

### Usage

\`\`\`bash
rulebound init [options]
\`\`\`

### Options

| Flag | Description |
|------|-------------|
| \`--examples\` | Copy example rules to get started. |
| \`--pack <name>\` | Install a curated rule pack (repeatable). |
| \`--no-hook\` | Skip pre-commit hook installation. |
| \`--migrate\` | Auto-import rules from existing agent configs (\`CLAUDE.md\`, \`.cursorrules\`, \`AGENTS.md\`, etc.). |

\`--pack\` accepts \`starter\`, \`typescript\`, \`security\`, \`react\`, \`java-spring\`, \`go\`, \`infra\`, \`global\`, \`agent-workflow\`, \`monorepo\`, \`deterministic\`, plus the opt-in analyzer packs \`analyzer-typescript\`, \`analyzer-java\`, and \`analyzer-security\`. Run \`rulebound packs list\` for the canonical, up-to-date list with descriptions.

### What it creates

| Path | Description |
|------|-------------|
| \`.rulebound/config.json\` | Project configuration template. |
| \`.rulebound/rules/\` | Rules directory (populated by \`--examples\` or \`--pack\`). |
| \`.git/hooks/pre-commit\` | Pre-commit hook (unless \`--no-hook\`). |

### Config template

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

### Pre-commit hook

The auto-installed hook runs \`rulebound diff --ref HEAD\` on every commit. If violations are found, the commit is blocked.

\`\`\`bash
# Skip the hook during init
rulebound init --no-hook

# Install or remove the hook separately later
rulebound hook
rulebound hook --remove
\`\`\`

### Examples

\`\`\`bash
# Minimum viable init — just the directory + config
rulebound init --no-hook

# Recommended first run: deterministic-only baseline, no analyzers required
rulebound init --pack starter --no-hook

# Layer in stack-specific packs
rulebound init --pack typescript --pack security --pack agent-workflow

# Opt-in analyzer packs (need external tools + --allow-commands at check time)
rulebound init --pack analyzer-typescript
rulebound init --pack analyzer-java
rulebound init --pack analyzer-security

# Backwards-compatible example rules
rulebound init --examples

# Examples + auto-import from existing agent configs
rulebound init --examples --migrate
\`\`\`

### Next steps

1. Edit \`.rulebound/config.json\` with your project info (stack, scope, team).
2. Add or tune rules as markdown files in \`.rulebound/rules/\`.
3. Run [\`rulebound doctor\`](/docs/cli/doctor) to confirm the environment looks right.
4. Run [\`rulebound check\`](/docs/cli/check) — that is the canonical gate.
5. Generate agent configs with \`rulebound generate\`.

> If the rules directory already exists, \`init\` exits without overwriting.
`,
}

export default doc
