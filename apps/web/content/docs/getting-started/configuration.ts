import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "getting-started/configuration",
  title: "Configuration",
  description:
    "Configure Rulebound for your project with config.json, enforcement modes, and rule inheritance.",
  content: `## Configuration

Rulebound is configured through \`.rulebound/config.json\` in your project root. This file is created by \`rulebound init\` and controls rule loading, context matching, inheritance, and enforcement.

### Config File

\`\`\`json
{
  "project": {
    "name": "auth-service",
    "stack": ["java", "spring-boot"],
    "scope": ["backend"],
    "team": "backend"
  },
  "extends": [
    "../shared-rules/.rulebound/rules",
    "@company/rules"
  ],
  "rulesDir": ".rulebound/rules",
  "enforcement": {
    "mode": "moderate",
    "scoreThreshold": 70,
    "autoPromote": true
  }
}
\`\`\`

### Project Section

The \`project\` block describes your project for context-aware rule matching:

| Field | Type | Description |
|-------|------|-------------|
| \`name\` | \`string\` | Project identifier |
| \`stack\` | \`string[]\` | Tech stack tags (e.g., \`["typescript", "react", "postgresql"]\`) |
| \`scope\` | \`string[]\` | Project scope (e.g., \`["frontend", "dashboard"]\`) |
| \`team\` | \`string\` | Team name for team-specific rule filtering |

When you run \`validate\`, \`diff\`, or \`ci\`, Rulebound uses these fields to select which rules apply. Rules with matching \`stack\`, \`scope\`, or \`team\` metadata score higher and are prioritized.

### Stack Auto-Detection

If \`stack\` is not set, Rulebound can detect your stack from project files:

| File | Detected Stack |
|------|---------------|
| \`package.json\` | typescript, javascript |
| \`pom.xml\`, \`build.gradle\` | java, spring-boot |
| \`go.mod\` | go |
| \`Cargo.toml\` | rust |
| \`requirements.txt\`, \`pyproject.toml\` | python |
| \`Dockerfile\` | docker |

### Extends (Inheritance)

The \`extends\` array lets you inherit rules from other sources. Local rules override inherited rules with the same ID.

\`\`\`json
{
  "extends": [
    "../shared-rules/.rulebound/rules",
    "@company/rules"
  ]
}
\`\`\`

Rulebound resolves extends paths in this order:

1. **Relative paths** -- Resolved from the project root
2. **Package paths** -- Looked up in \`node_modules/<package>/rules\` or \`node_modules/<package>/.rulebound/rules\`

See [Rule Inheritance](/docs/rules/rule-inheritance) for more detail.

### Enforcement Section

Controls how strictly Rulebound enforces rules:

\`\`\`json
{
  "enforcement": {
    "mode": "moderate",
    "scoreThreshold": 70,
    "autoPromote": true
  }
}
\`\`\`

| Field | Default | Description |
|-------|---------|-------------|
| \`mode\` | \`"advisory"\` | \`advisory\` (never blocks), \`moderate\` (blocks MUST violations + low score), \`strict\` (blocks any violation) |
| \`scoreThreshold\` | \`70\` | Minimum score (0-100) to pass in moderate/strict mode |
| \`autoPromote\` | \`true\` | Suggest promoting enforcement level when score reaches 90+ |

You can also set enforcement from the CLI:

\`\`\`bash
rulebound enforce --mode strict --threshold 80
\`\`\`

See [Enforcement Modes](/docs/enforcement/overview) for details.

### Rules Directory

By default, rules live in \`.rulebound/rules/\`. Override with:

\`\`\`json
{
  "rulesDir": "custom/rules/path"
}
\`\`\`

Rulebound also checks these fallback locations:

1. \`.rulebound/rules/\`
2. \`rules/\`
3. \`examples/rules/\`
`,
}

export default doc
