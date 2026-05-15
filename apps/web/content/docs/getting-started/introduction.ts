import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "getting-started/introduction",
  title: "Introduction",
  description:
    "Rulebound is a deterministic guardrail platform for AI coding agents. Define rules with executable checks and gate every plan, diff, and commit against them.",
  content: `## What is Rulebound?

Rulebound is an open-source deterministic guardrail platform for AI coding agents. You declare your repo policies as Markdown rules with executable \`checks:\` blocks, and \`rulebound check\` becomes the authoritative pass/fail gate — in the CLI, in MCP, and in CI.

Deterministic first. Advisory second. \`rulebound check\` answers narrow, checkable questions like "did the schema change include a migration?", "did the bugfix include a regression test?", "did PMD/Checkstyle/SpotBugs/ESLint/Semgrep/gitleaks report a violation?". Advisory matching (keyword, semantic, LLM) is available for early planning feedback, but it never decides the final verdict by itself.

## Key Features

- **Deterministic blocks** — \`checks:\` blocks in rule front matter (\`file-exists\`, \`regex\`, \`diff-evidence\`, \`forbidden-import\`, \`ast\`, \`command\`, \`analyzer\`, \`agent-process\`) produce reproducible pass/fail verdicts.
- **Advisory warnings** — keyword and semantic matchers spot likely violations early; they warn but never block on their own.
- **Analyzers orchestrated, not reimplemented** — Rulebound consumes the XML/SARIF that PMD, Checkstyle, SpotBugs, ESLint, tsc, Semgrep, gitleaks, JUnit/Surefire already produce. It does not ship its own language ruleset.
- **Self-healing repair loop** — \`rulebound heal\` and \`--format repair-json\` give agents structured failure evidence and a deterministic re-run as the final judge.
- **Bugfix boundary workflow** — \`rulebound bugfix\` declares bug condition, postcondition, preservation scenarios, and scope so an agent cannot silently refactor outside the fix.
- **Time-boxed waivers** — explicit, owner-stamped, expiring downgrades. Never silent. Expired waivers re-block.
- **MCP server** — agents call \`run_deterministic_checks\`, \`check_diff\`, and \`get_repair_instructions\` inside their loop; the CLI/CI remains the final authority.
- **CI integration** — first-class GitHub Action with \`github\`, \`sarif\`, and \`pr-markdown\` formats; the deterministic gate is the only thing that fails the PR by default.

## Architecture Overview

Rulebound is a monorepo. The production surface is the CLI plus the MCP server. The other packages are either supporting libraries or optional/advanced surfaces.

| Package | Purpose |
|---------|---------|
| \`@rulebound/cli\` | End-user CLI (\`rulebound\`). The canonical deterministic gate. |
| \`@rulebound/engine\` | Rule loader, deterministic check runners, report schema. |
| \`@rulebound/shared\` | Shared types and utilities. |
| \`@rulebound/mcp\` | MCP server exposing deterministic + advisory tools to agents. |
| \`@rulebound/gateway\` | Optional HTTP proxy for LLM providers (advanced). |
| \`@rulebound/lsp\` | Optional LSP server (experimental). |
| \`@rulebound/server\` | Optional HTTP API (preview). |

### How It Works

1. **Define** — write rules in \`.rulebound/rules/*.md\`. Each rule can carry one or more \`checks:\` blocks.
2. **Discover** — agents call \`find_rules\` (or run \`rulebound find-rules\`) to pull the relevant subset for a task.
3. **Advise** — \`rulebound advise\` and the MCP \`validate_plan\` tool give early, non-blocking feedback on plans and diffs.
4. **Check** — \`rulebound check\` runs every deterministic check against the working tree and changed files. The report is the authoritative pass/fail.
5. **Heal** — \`rulebound heal\` (or the MCP \`get_repair_instructions\` loop) feeds structured failures back to the agent until checks are green or iterations are exhausted.

## Next Steps

- [Quick Start](/docs/getting-started/quick-start) — get \`rulebound check\` green in under 10 minutes.
- [CLI Overview](/docs/cli/overview) — every command and what it gates.
- [Deterministic Checks](/docs/rules/deterministic-checks) — the full \`checks:\` schema.
- [GitHub Action](/docs/ci/github-action) — wire the deterministic gate into PRs.
- [MCP Setup](/docs/mcp/setup) — connect the agent loop.
`,
}

export default doc
