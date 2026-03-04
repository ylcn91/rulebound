import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/report",
  title: "Generation & Reporting",
  description:
    "Generate agent configs, manage enforcement settings, and install git hooks with Rulebound CLI.",
  content: `## Generation & Reporting Commands

Commands for generating agent configs, managing enforcement, and integrating with git.

### rulebound generate

Generate agent config files from your rules. Exports rules in the format each AI agent expects.

\`\`\`bash
rulebound generate [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`-a, --agent <agent>\` | Agent type: \`claude-code\`, \`cursor\`, \`copilot\`, \`all\` (default: all) |
| \`-t, --task <text>\` | Only include rules relevant to this task |
| \`-d, --dir <path>\` | Path to rules directory |
| \`-o, --output <path>\` | Output directory (default: current dir) |

**Generated files:**

| Agent | File | Format |
|-------|------|--------|
| Claude Code | \`CLAUDE.md\` | Markdown with MUST/SHOULD prefixes |
| Cursor | \`.cursor/rules.md\` | Markdown project rules |
| GitHub Copilot | \`.github/copilot-instructions.md\` | Copilot instructions format |

**Examples:**

\`\`\`bash
# Generate for all agents
rulebound generate

# Only Claude Code
rulebound generate --agent claude-code

# Task-filtered rules (only inject relevant rules)
rulebound generate --agent cursor --task "build authentication"

# Custom output directory
rulebound generate --output ./config
\`\`\`

Each generated file includes MUST/SHOULD/MAY prefixes, severity indicators, bullet points, and good code examples extracted from your rules.

> Commit the generated files so your AI agents pick them up automatically.

---

### rulebound enforce

View or update enforcement mode.

\`\`\`bash
rulebound enforce [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`-m, --mode <mode>\` | Set mode: \`advisory\`, \`moderate\`, \`strict\` |
| \`-t, --threshold <number>\` | Set score threshold (0-100) |

**Without options**, shows current enforcement config:

\`\`\`bash
rulebound enforce
\`\`\`

\`\`\`
  Enforcement Configuration
  ========================

  Mode:            advisory (never blocks)
  Score threshold:  70
  Auto-promote:     enabled
\`\`\`

**Update enforcement:**

\`\`\`bash
# Switch to moderate mode
rulebound enforce --mode moderate

# Set strict mode with higher threshold
rulebound enforce --mode strict --threshold 80
\`\`\`

Settings are saved to \`.rulebound/config.json\`.

---

### rulebound hook

Install or remove the pre-commit git hook.

\`\`\`bash
rulebound hook [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`--remove\` | Remove the pre-commit hook |

**Examples:**

\`\`\`bash
# Install hook
rulebound hook

# Remove hook
rulebound hook --remove
\`\`\`

The hook runs \`rulebound diff --ref HEAD\` on staged changes. If violations are detected, the commit is blocked.

---

### rulebound ci

Validate PR changes in CI/CD pipelines.

\`\`\`bash
rulebound ci [options]
\`\`\`

| Flag | Description |
|------|-------------|
| \`-b, --base <branch>\` | Base branch to diff against (default: main) |
| \`-f, --format <format>\` | Output: \`pretty\`, \`json\`, \`github\` |
| \`--llm\` | Use LLM for deep validation |
| \`-d, --dir <path>\` | Path to rules directory |

**Examples:**

\`\`\`bash
# Default (pretty output, diff against main)
rulebound ci

# GitHub Actions format with annotations
rulebound ci --format github

# Diff against develop branch
rulebound ci --base develop

# JSON output for custom processing
rulebound ci --format json
\`\`\`

The \`github\` format emits \`::error::\` and \`::warning::\` annotations that appear directly on PR files in GitHub.

Exit codes:
- \`0\` -- Passed
- \`1\` -- Failed (violations or blocked by enforcement)
- \`2\` -- Error (no rules found, git error)

See [CI/CD Integration](/docs/enforcement/ci-cd) for pipeline setup.
`,
}

export default doc
