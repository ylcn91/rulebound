import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/packs",
  title: "rulebound packs",
  description:
    "List the curated rule packs that ship with the CLI. Install them through rulebound init --pack <name>.",
  content: `## rulebound packs

\`rulebound packs\` lists the curated rule packs bundled with the CLI. Install them through \`rulebound init --pack <name>\` (repeatable).

### Usage

\`\`\`bash
rulebound packs list [options]
\`\`\`

### Options

| Flag | Default | Description |
|------|---------|-------------|
| \`-f, --format <format>\` | \`pretty\` | \`pretty\` or \`json\`. |

### Examples

\`\`\`bash
# Human-readable
rulebound packs list

# Machine-readable
rulebound packs list --format json
\`\`\`

### Available packs

These are the packs that ship today. The CLI is the source of truth — if a name here ever disagrees with \`rulebound packs list\`, trust the CLI.

| Pack | Description |
|------|-------------|
| \`starter\` | Pure deterministic baseline (no external analyzers). Good first pack. |
| \`deterministic\` | Broader deterministic rule baseline. |
| \`typescript\` | TypeScript / JavaScript style and safety rules. |
| \`security\` | Cross-language security rules (secrets, dangerous APIs, etc.). |
| \`react\` | React best practices. |
| \`java-spring\` | Java + Spring Boot conventions. |
| \`go\` | Go style and project conventions. |
| \`infra\` | Infra (Docker, Terraform, GitHub Actions, etc.) conventions. |
| \`global\` | Cross-stack baseline rules. |
| \`agent-workflow\` | Agent process / bugfix workflow rules. |
| \`monorepo\` | Monorepo boundary and structure rules. |
| \`analyzer-typescript\` | Opt-in analyzer pack: \`eslint\` + \`tsc --noEmit\`. Requires \`--allow-commands\`. |
| \`analyzer-java\` | Opt-in analyzer pack: PMD, Checkstyle, SpotBugs, JUnit/Surefire. Requires Maven + \`--allow-commands\`. |
| \`analyzer-security\` | Opt-in analyzer pack: Semgrep + gitleaks. Requires \`--allow-commands\`. |

### Installing a pack

\`\`\`bash
# Single pack
rulebound init --pack starter --no-hook

# Multiple packs
rulebound init --pack typescript --pack security --pack agent-workflow

# Analyzer packs (need external tools on PATH and --allow-commands at check time)
rulebound init --pack analyzer-typescript
rulebound check --allow-commands
\`\`\`

\`init --pack\` is repeatable. Re-running \`init\` against an already-initialized repo will not overwrite the existing rules directory.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success. |

### Related

- [\`rulebound init\`](/docs/cli/init) — how packs are installed.
- [Analyzer Orchestration](/docs/recipes/orchestration) — what the \`analyzer-*\` packs wire in.
`,
}

export default doc
