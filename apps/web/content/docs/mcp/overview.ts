import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "mcp/overview",
  title: "MCP Server Overview",
  description:
    "Rulebound MCP — deterministic tools (run_deterministic_checks, check_diff, get_repair_instructions) are authoritative; validate_plan and other advisory tools provide early feedback. CLI / CI remain the final authority.",
  content: `## MCP Server Overview

Rulebound ships an MCP (Model Context Protocol) server (\`@rulebound/mcp\`) so coding agents can query rules, get advisory planning feedback, and run **deterministic** checks during a task. The deterministic tools are authoritative; advisory tools (\`validate_plan\`, \`find_rules\`, \`check_code\`, \`list_rules\`, \`validate_before_write\`) provide early or supporting feedback. \`rulebound check\` in the workspace or CI remains the final authority.

The MCP server reuses the same rule loader as the CLI: rules live in \`.rulebound/rules/\` of the workspace the agent is operating in.

### Deterministic tools (authoritative)

These three tools wrap the same \`validateDeterministic()\` engine as the CLI. Use them after writing code, before declaring success, and inside a repair loop.

| Tool | Purpose |
|------|---------|
| \`run_deterministic_checks\` | Run authoritative deterministic checks (\`file-exists\`, \`regex\`, \`diff-evidence\`, \`forbidden-import\`, \`ast\`, \`command\`, \`analyzer\`, \`agent-process\`) defined in rules' \`checks:\` blocks against the working tree. The source of truth for rule compliance — unlike \`validate_plan\` which is advisory. |
| \`check_diff\` | Run deterministic checks against only the files changed vs a base ref (default \`HEAD\`). Auto-populates the changed file list via \`git diff --name-only base...HEAD\`. Returns a no-op PASSED summary when the diff is empty. Use in CI-style flows or after a series of edits. |
| \`get_repair_instructions\` | Run deterministic checks and return a structured repair-loop payload: one entry per VIOLATED/ERROR result with \`rule_id\`, \`file\`, \`line\`, \`reason\`, \`suggested_fix\`, \`source\`, and a \`rerun_command\` the agent can run after applying the fix. Designed for an automated repair loop. |

See [Deterministic Tools](/docs/mcp/deterministic-tools) for the full input/output reference.

### Advisory tools (planning / supporting)

These tools provide early feedback or supporting context. They are **not** the deterministic gate.

| Tool | Purpose |
|------|---------|
| \`validate_plan\` | ADVISORY plan check against project rules using keyword/semantic matchers. Not authoritative unless the matched rules carry deterministic \`checks:\` blocks. Use early to spot likely violations in a plan before coding. |
| \`find_rules\` | Find relevant project rules for a given task. MUST be called before starting any implementation to understand project constraints and coding standards. Returns only rules relevant to the task and tech stack. |
| \`check_code\` | Advisory snippet-level check for quick feedback. |
| \`list_rules\` | List all rules in the workspace, filtered by detected stack. |
| \`validate_before_write\` | Advisory/pre-write feedback before code lands on disk. |
| \`start_bugfix_workflow\` | Create a bugfix boundary spec for behavior-preserving fixes. See [Bugfix Workflow](/docs/workflows/bugfix-workflow). |
| \`validate_bugfix_plan\` | Check a bugfix plan against the stored boundary spec. |

## How agents should use it

A correct agent loop:

1. **Discover** — \`find_rules\` with the task description.
2. **Plan** — produce a plan. Optionally call \`validate_plan\` for advisory feedback.
3. **Write** — implement.
4. **Verify** — \`run_deterministic_checks\` or \`check_diff\`. This is the authoritative step.
5. **Repair** — if failures exist, call \`get_repair_instructions\`, apply the smallest fix per failure, re-run.
6. **Confirm** — run \`rulebound check\` via shell or CI. Do not declare the task complete while deterministic checks are \`FAILED\`.

## What MCP does not do

- It does not replace \`rulebound check\`. The deterministic CLI run is the authoritative pass/fail. MCP tools surface findings and rule context inside the agent loop.
- It does not run arbitrary commands without explicit configuration. Analyzer / command checks still require \`--allow-commands\` (or \`allow_commands: true\` on the deterministic tools) when invoked.
- It does not learn or remember across sessions. Rules are reloaded from disk on every relevant call.
- It does not judge future scenario evidence with an LLM. When scenario evidence is added, MCP should pass deterministic scenario reports from external tools into the same evidence/check loop.

## Related

- [MCP Setup](/docs/mcp/setup) — agent configuration (Claude Code, Cursor, Amp, generic).
- [Deterministic Tools](/docs/mcp/deterministic-tools) — full schema for the three authoritative tools.
- [Configuration](/docs/mcp/configuration) — extra wiring notes.
- [Self-Healing Loop](/docs/workflows/self-healing) — repair JSON contract.
`,
}

export default doc
