import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "mcp/deterministic-tools",
  title: "Deterministic MCP Tools",
  description:
    "run_deterministic_checks, check_diff, get_repair_instructions — the three authoritative MCP tools that wrap the same engine as rulebound check.",
  content: `## Deterministic MCP tools

These three tools wrap \`validateDeterministic()\` from \`@rulebound/engine\` — the same engine \`rulebound check\` uses. They are the authoritative pass/fail surface inside an agent loop.

The descriptions and parameter docs below come straight from \`packages/mcp/src/index.ts\`.

## \`run_deterministic_checks\`

Run authoritative deterministic checks (\`file-exists\`, \`regex\`, \`diff-evidence\`, \`forbidden-import\`, \`ast\`, \`command\`, \`analyzer\`, \`agent-process\`) defined in rules' \`checks:\` blocks against the working tree. This is the source of truth for rule compliance — unlike \`validate_plan\` which is advisory. Returns rule statuses, blocking count, and the first 5 violations with file/line evidence. Use this after writing code, before committing, and inside a repair loop.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| \`changed_files\` | \`string[]\` (optional) | Files changed in this work unit (for \`diff-evidence\` checks). If omitted, file globs are applied to the entire repo. |
| \`branch\` | \`string\` (optional) | Current branch name (used by \`diff-evidence\` \`branch_matches\` rules). |
| \`allow_commands\` | \`boolean\` (optional) | Allow running \`command\` and \`analyzer\` checks that execute subprocesses (default: \`false\`). Only enable in trusted local contexts. |

### When to call

- After writing code, before declaring success.
- Inside the repair loop, after the agent applies a fix.
- Whenever a deterministic verdict over the **full repo** (not just the diff) is needed.

## \`check_diff\`

Run deterministic checks against only the files changed vs a base ref (default \`HEAD\`). Auto-populates the changed file list via \`git diff --name-only base...HEAD\`. Returns a no-op \`PASSED\` summary when the diff is empty. Use this in CI-style flows or after a series of edits to verify nothing regressed.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| \`base\` | \`string\` (optional) | Base ref to diff against (default: \`HEAD\`). Use the merge-base of the feature branch for PR-style checks. |
| \`branch\` | \`string\` (optional) | Current branch name (for \`diff-evidence\` \`branch_matches\` rules). |
| \`staged\` | \`boolean\` (optional) | Use \`git diff --cached\` (staged changes) instead of a ref-based diff. |
| \`allow_commands\` | \`boolean\` (optional) | Allow command/analyzer checks (default: \`false\`). |

### When to call

- After a series of edits, before opening a PR.
- In CI-style flows that already know the PR base ref.
- When the agent wants a quick "did anything regress" gate scoped to the work it just did.

## \`get_repair_instructions\`

Run deterministic checks and return a structured repair-loop payload: one entry per VIOLATED/ERROR result with \`rule_id\`, \`file\`, \`line\`, \`reason\`, \`suggested_fix\`, \`source\`, and a \`rerun_command\` the agent can run after applying the fix. Designed for an agent's automated repair loop.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| \`changed_files\` | \`string[]\` (optional) | Files changed in this work unit. |
| \`branch\` | \`string\` (optional) | Current branch name. |
| \`allow_commands\` | \`boolean\` (optional) | Allow command/analyzer checks (default: \`false\`). |
| \`limit\` | \`number\` (optional) | Maximum number of instructions to return (default: \`20\`). |

### When to call

- When \`run_deterministic_checks\` or \`check_diff\` returns \`FAILED\` and the agent needs structured, per-failure repair guidance.
- At the top of every repair-loop iteration: read \`rerun_command\`, apply the smallest fix, re-run the command, repeat.

See [Self-Healing Loop](/docs/workflows/self-healing) for the full repair-JSON shape and the agent loop contract.

## Authority

These three tools are the only MCP surface that can declare compliance. \`validate_plan\`, \`find_rules\`, \`check_code\`, \`list_rules\`, and \`validate_before_write\` are advisory — they help the agent steer but never decide pass/fail by themselves.

\`rulebound check\` in the workspace or CI remains the final authority outside the agent loop. The MCP deterministic tools and the CLI return the same \`DeterministicReport\` shape — see [Report Schema](/docs/rules/report-schema).

## Related

- [MCP Overview](/docs/mcp/overview) — deterministic + advisory tool list.
- [MCP Setup](/docs/mcp/setup) — wiring into Claude Code, Cursor, Amp.
- [Self-Healing Loop](/docs/workflows/self-healing) — repair JSON contract.
`,
}

export default doc
