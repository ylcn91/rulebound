import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "cli/heal",
  title: "rulebound heal",
  description:
    "Self-healing loop. Runs deterministic checks, optionally executes a repair command, re-runs the same checks, and stops when green or iterations are exhausted.",
  content: `## rulebound heal

\`rulebound heal\` runs deterministic checks, hands machine-readable failure evidence to an agent (or a scripted repair), lets that step make the smallest fix, re-runs the same checks, and stops when green or the iteration cap is reached.

The **final pass/fail is always decided by deterministic checks re-running**, not by an LLM explanation. That is the deterministic-final-judge rule and it is non-negotiable.

### Usage

\`\`\`bash
rulebound heal [options]
\`\`\`

### Options

| Flag | Default | Description |
|------|---------|-------------|
| \`-d, --dir <path>\` | auto-detect | Path to the rules directory. |
| \`--max-iterations <n>\` | \`3\` | Clamped to \`[1, 10]\`. |
| \`--cmd <command>\` | none | Shell command run between iterations (the "repair step"). |
| \`--allow-commands\` | off | Allow \`type: command\` / \`type: analyzer\` checks to exec. |
| \`-f, --format <format>\` | \`pretty\` | \`pretty\` or \`json\`. |

### Examples

\`\`\`bash
# Plain re-run loop (no scripted repair; agent repairs externally)
rulebound heal --max-iterations 3

# With a repair step between iterations
rulebound heal --max-iterations 3 --cmd "pnpm tsc --noEmit && pnpm lint --fix"

# JSON output suitable for an agent driver
rulebound heal --format json
\`\`\`

### Loop semantics

1. Run \`validateDeterministic\` against the loaded rules.
2. If the report status is not \`FAILED\`, exit \`0\` with \`status: "GREEN"\`.
3. On the final iteration with \`FAILED\` status, exit \`1\` with \`status: "EXHAUSTED"\`.
4. Otherwise: if \`--cmd\` is provided, run it; either way go to step 1.

When \`--cmd\` is omitted, \`heal\` simply re-runs the checks. That is useful when the agent is doing the repair externally between iterations and wants to poll the state.

### Pairing with repair JSON

The companion contract is \`rulebound check --format repair-json\`. It produces a compact, machine-readable failure report intended to be fed back to an agent. See [Self-Healing Loop](/docs/workflows/self-healing) for the full repair-JSON shape, the agent loop contract, and the rules an agent must follow.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Loop reached \`GREEN\`. |
| 1 | Loop exhausted iterations while still \`FAILED\`. |
| 2 | Config error (no rules directory). |

### Related

- [Self-Healing Loop](/docs/workflows/self-healing) — repair JSON contract and agent loop.
- [\`rulebound check\`](/docs/cli/check) — the deterministic engine \`heal\` re-runs each iteration.
`,
}

export default doc
