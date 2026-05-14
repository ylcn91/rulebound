import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/evidence",
  title: "rulebound evidence",
  description:
    "Thin wrapper over rulebound check that defaults to the pr-markdown evidence format. Same engine, same exit codes — different default output.",
  content: `## rulebound evidence

\`rulebound evidence\` is a thin wrapper over [\`rulebound check\`](/docs/cli/check) that defaults to the \`pr-markdown\` format. It is intended for "give me a human-readable evidence summary I can paste into a PR description or a CI step summary" workflows.

Same engine, same options, same exit codes — only the default format differs.

### Usage

\`\`\`bash
rulebound evidence [options]
\`\`\`

### Options

| Flag | Default | Description |
|------|---------|-------------|
| \`-d, --dir <path>\` | auto-detect | Path to the rules directory. |
| \`-f, --format <format>\` | \`pr-markdown\` | \`pretty\`, \`json\`, \`github\`, \`sarif\`, \`pr-markdown\`, \`repair-json\`. |
| \`--diff\` | off | Restrict diff-evidence checks to working-tree diff files. |
| \`--staged\` | off | Use staged changes for diff context. |
| \`-b, --base <branch>\` | none | Base branch for diff context. |
| \`--ref <ref>\` | none | Git ref for diff context. |
| \`--rule <id>\` | none | Run only rules whose ID matches or is prefixed by \`<id>\`. |
| \`--allow-commands\` | off | Permit \`type: command\` / \`type: analyzer\` checks that exec shell. |
| \`--fail-on-advisory\` | off | Exit non-zero (3) when advisory findings are present. |
| \`--waivers <path>\` | \`.rulebound/waivers.yaml\` | Path to the waivers YAML. |

### Examples

\`\`\`bash
# Default PR-markdown summary for the current diff
rulebound evidence --base main

# Append to a GitHub Actions step summary
rulebound evidence --base main >> "$GITHUB_STEP_SUMMARY"

# Switch the format if you really want the same wrapper but a different output
rulebound evidence --format sarif --base main > rulebound.sarif
\`\`\`

### \`pr-markdown\` shape

The \`pr-markdown\` output keeps deterministic blockers, deterministic warnings, advisory-only rules, waivers, and analyzer findings in distinct sections. A waived finding can never be confused with a pass; an advisory-only rule never appears as a blocker. See [\`rulebound check\`](/docs/cli/check) for an example excerpt.

### Exit codes

Same contract as \`rulebound check\`:

| Code | Meaning |
|------|---------|
| 0 | All deterministic checks passed. |
| 1 | One or more deterministic violations blocked the run. |
| 2 | Config/runtime error. |
| 3 | Advisory-only violations present and \`--fail-on-advisory\` was set. |

### Related

- [\`rulebound check\`](/docs/cli/check) — same engine, different default format.
- [GitHub Action](/docs/ci/github-action) — \`pr-markdown-summary\` input wraps this for PRs.
`,
}

export default doc
