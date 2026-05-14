import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/overview",
  title: "CLI Overview",
  description:
    "Rulebound CLI reference — the canonical deterministic gate (rulebound check) plus diagnostics, content management, and advisory tools.",
  content: `## CLI Overview

\`rulebound check\` is the canonical deterministic gate. Other commands are diagnostics, content management, or advisory/legacy. They support the workflow; they do not replace it.

### Installation

\`\`\`bash
npm install -g @rulebound/cli
# or
pnpm add -g @rulebound/cli
\`\`\`

### Usage

\`\`\`bash
rulebound <command> [options]
\`\`\`

### Commands by group

Help groups match what \`rulebound --help\` prints. Read the canonical list from \`packages/cli/src/index.ts\` if you ever need to confirm a command still exists.

#### Primary (deterministic gate + setup)

| Command | Description |
|---------|-------------|
| [\`check\`](/docs/cli/check) | Run deterministic rule checks (canonical command). |
| [\`heal\`](/docs/cli/heal) | Self-healing loop: run checks, optionally repair, re-run. |
| [\`doctor\`](/docs/cli/doctor) | Detect rules, config, toolchains, and analyzer availability. |
| [\`evidence\`](/docs/cli/evidence) | Produce a deterministic evidence report (defaults to \`pr-markdown\`). Thin wrapper over \`check\`. |
| [\`init\`](/docs/cli/init) | Initialize \`.rulebound/\` with rules directory and config. |
| [\`packs\`](/docs/cli/packs) | List and use curated rule packs. |

#### Rules & content

| Command | Description |
|---------|-------------|
| \`rules list\` | List all rules with metadata. |
| \`rules show <id>\` | Show full detail of a single rule. |
| \`rules lint\` | Score rules on quality (atomicity, completeness, clarity). |
| \`rules history <id>\` | Show git-based version history of a rule. |
| \`find-rules\` | Find and inject relevant rules for a task. |
| \`generate\` | Generate agent config files (\`CLAUDE.md\`, \`.cursor/rules.md\`, \`copilot-instructions.md\`). |
| \`migrate\` | Import rules from existing \`CLAUDE.md\`, \`.cursorrules\`, or other agent configs. |
| \`registry search/install/list/info\` | Search and install rule packages from npm. |
| \`bugfix\` / \`bugfix validate\` | Create and validate a bugfix boundary spec — see [Bugfix Workflow](/docs/workflows/bugfix-workflow). |
| \`agents list\` | List configured agent profiles. |
| \`score\` | Calculate rule quality score and generate a badge. |
| \`enforce\` | View or update enforcement mode (\`advisory\`, \`moderate\`, \`strict\`). |
| \`hook\` | Install or remove the pre-commit git hook. |
| [\`watch\`](/docs/cli/watch) | Watch files for changes and run real-time rule + AST validation. |
| \`stats\` | Show validation statistics and analytics. |
| \`check-code\` | Analyze a source file with AST-based anti-pattern detection (tree-sitter). |

#### Diagnostics / advisory

| Command | Description |
|---------|-------------|
| [\`advise\`](/docs/cli/advise) | Advisory plan/diff review (keyword/semantic/LLM). NOT the deterministic gate; use \`check\` for that. |

#### Advisory / legacy

| Command | Description |
|---------|-------------|
| \`validate\` | Advisory plan validation against matched rules. |
| \`diff\` | Advisory git diff validation against matched rules. |
| \`ci\` | Legacy advisory PR validation; prefer \`rulebound check --format github\`. |
| \`review\` | Advisory multi-agent review with consensus; not the deterministic gate. |

### Common options

Most deterministic and content commands accept these flags:

| Flag | Description |
|------|-------------|
| \`-d, --dir <path>\` | Path to rules directory (overrides auto-detect). |
| \`-f, --format <format>\` | Output format. Varies per command (e.g. \`pretty\`, \`json\`, \`github\`, \`repair-json\`, \`sarif\`, \`pr-markdown\`). |
| \`--allow-commands\` | Permit \`type: command\` and \`type: analyzer\` checks that exec shell. Required for analyzer recipes. |

### Workflow example

\`\`\`bash
# 1. Initialize with a starter deterministic pack
rulebound init --pack starter --no-hook

# 2. Sanity-check the environment
rulebound doctor

# 3. Run the authoritative gate
rulebound check

# 4. Scope to the current PR diff
rulebound check --base main --format github

# 5. Get a structured repair payload for an agent
rulebound check --format repair-json

# 6. Run the self-healing loop
rulebound heal --max-iterations 3 --cmd "pnpm tsc --noEmit && pnpm lint --fix"
\`\`\`

### Exit codes

\`rulebound check\` (and \`evidence\` / \`heal\`) follow the CI contract:

| Code | Meaning |
|------|---------|
| 0 | All deterministic checks passed. |
| 1 | One or more deterministic violations blocked the run. |
| 2 | Configuration or runtime error (no rules found, invalid arguments, waiver parse error). |
| 3 | Advisory-only violations present and \`--fail-on-advisory\` was set. |
`,
}

export default doc
