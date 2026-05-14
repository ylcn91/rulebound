import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/check",
  title: "rulebound check",
  description:
    "The canonical deterministic gate. Runs every checks: block against the working tree and changed files, then exits with a pass/fail.",
  content: `## rulebound check

\`rulebound check\` is the canonical deterministic gate. It loads every rule under \`.rulebound/rules/\`, executes their \`checks:\` blocks against the working tree (and optionally the diff context), and exits with a pass/fail. The report it produces is the authoritative answer; advisory commands like \`validate\`, \`diff\`, \`review\`, and \`advise\` are not.

### Usage

\`\`\`bash
rulebound check [options]
\`\`\`

### Options

| Flag | Default | Description |
|------|---------|-------------|
| \`-d, --dir <path>\` | auto-detect | Path to the rules directory. |
| \`-f, --format <format>\` | \`pretty\` | One of \`pretty\`, \`json\`, \`github\`, \`repair-json\`, \`sarif\`, \`pr-markdown\`. |
| \`--diff\` | off | Restrict diff-evidence checks to working-tree diff files. |
| \`--staged\` | off | Use staged changes (\`git diff --cached\`) for diff context. |
| \`-b, --base <branch>\` | none | Base branch for diff context (\`<base>...HEAD\`). |
| \`--ref <ref>\` | none | Git ref for diff context. |
| \`--rule <id>\` | none | Run only rules whose ID matches or is prefixed by \`<id>\`. |
| \`--allow-commands\` | off | Permit \`type: command\` and \`type: analyzer\` checks that exec shell. |
| \`--fail-on-advisory\` | off | Exit non-zero (3) when advisory findings are present. |
| \`--waivers <path>\` | \`.rulebound/waivers.yaml\` | Path to the waivers YAML. |

### Examples

\`\`\`bash
# Full repo check
rulebound check

# Diff-scoped checks against main
rulebound check --base main

# PR-style annotations for GitHub Actions
rulebound check --base main --format github

# SARIF for code-scanning upload
rulebound check --base main --format sarif > rulebound.sarif

# Structured repair payload for an agent loop
rulebound check --format repair-json

# Markdown evidence summary for the PR description
rulebound check --format pr-markdown --base main

# Enable analyzer checks (PMD, ESLint, semgrep, ...)
rulebound check --allow-commands --base main

# Run only one rule
rulebound check --rule db.schema-needs-migration
\`\`\`

### Output formats

- \`pretty\` — colorized human output: summary line, blockers, waived findings, expired waivers.
- \`json\` — full \`DeterministicReport\`. See [Report Schema](/docs/rules/report-schema).
- \`github\` — \`::error\` / \`::warning\` / \`::notice\` annotations plus a final status notice. Canonical CI format.
- \`repair-json\` — compact failure list with \`ruleId\`, \`checkId\`, \`file\`, \`line\`, \`reason\`, \`suggestedFix\`, \`rerun\`. Intended for agent repair loops.
- \`sarif\` — minimal SARIF 2.1.0 document. Suitable for GitHub code scanning.
- \`pr-markdown\` — sectioned markdown evidence report (blockers, warnings, waivers, analyzer findings, repair).

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | All deterministic checks passed. |
| 1 | One or more deterministic violations blocked the run. |
| 2 | Config/runtime error (no rules found, invalid arguments, waiver parse error). |
| 3 | Advisory-only violations present and \`--fail-on-advisory\` was set. |

### Related

- [Deterministic Checks](/docs/rules/deterministic-checks) — the full \`checks:\` schema.
- [Report Schema](/docs/rules/report-schema) — the JSON shape every formatter reads from.
- [Waivers](/docs/rules/waivers) — time-boxed downgrades.
- [GitHub Action](/docs/ci/github-action) — wiring \`check --format github\` into PRs.
- [Self-Healing Loop](/docs/workflows/self-healing) — using \`--format repair-json\` in a repair loop.
`,
}

export default doc
