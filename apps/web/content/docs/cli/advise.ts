import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/advise",
  title: "rulebound advise",
  description:
    "Advisory plan/diff review using keyword, semantic, and optional LLM matchers. NOT the deterministic gate — use rulebound check for that.",
  content: `## rulebound advise

\`rulebound advise\` performs **advisory** review of either a plan or a git diff using keyword, semantic, and optional LLM matchers. It is **not** the deterministic gate. Use [\`rulebound check\`](/docs/cli/check) for the authoritative pass/fail.

Use \`advise\` early — before code is written, while shaping a plan, or while iterating on a diff — to surface likely violations that the deterministic checks will or won't catch later.

### Usage

\`\`\`bash
rulebound advise [options]
\`\`\`

You must pass either a plan (\`--plan\` or \`--plan-file\`) **or** a diff (\`--diff\`, \`--staged\`, or \`--ref\`). Mixing the two is an error.

### Options

| Flag | Description |
|------|-------------|
| \`-p, --plan <text>\` | Plan text to review. |
| \`--plan-file <path>\` | Path to a plan markdown file. |
| \`--diff\` | Review current working-tree git diff (advisory). |
| \`--staged\` | Use staged changes instead of working-tree diff. |
| \`--ref <ref>\` | Git ref for the diff context. |
| \`--llm\` | Use LLM matcher (requires AI SDK + API key). |
| \`-d, --dir <path>\` | Path to the rules directory. |
| \`-f, --format <format>\` | \`pretty\` or \`json\` (default \`pretty\`). |

### Examples

\`\`\`bash
# Review a plan
rulebound advise --plan "Add a payment endpoint that reads STRIPE_KEY from process.env"

# Review a plan stored in a file
rulebound advise --plan-file design/plan.md --format json

# Review the staged diff
rulebound advise --staged

# Review against a specific ref
rulebound advise --ref origin/main

# Include LLM matcher (slower; requires AI SDK)
rulebound advise --plan-file design/plan.md --llm
\`\`\`

### What it is

- An early-feedback surface for plans and diffs.
- A view into which rules **might** be relevant to the current work, with reasons.
- A way to spot likely violations before \`rulebound check\` is even meaningful.

### What it is NOT

- The deterministic CI gate. Advisory findings are not blocking unless you explicitly opt in via \`rulebound check --fail-on-advisory\`.
- A replacement for \`rulebound check\`. After advising, run \`check\` against the working tree or diff to get the authoritative verdict.
- An LLM-as-judge. The \`--llm\` flag adds a matcher, not a decider.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Advisory review produced results (the command succeeded). |
| 2 | Bad invocation (e.g. both plan and diff inputs; nothing to review). |

### Related

- [\`rulebound check\`](/docs/cli/check) — the deterministic gate \`advise\` is **not**.
- [MCP \`validate_plan\`](/docs/mcp/overview) — the advisory tool agents call early in the loop.
`,
}

export default doc
