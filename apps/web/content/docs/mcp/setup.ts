import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "mcp/setup",
  title: "MCP Setup",
  description:
    "Wire @rulebound/mcp into Claude Code, Cursor, Amp, or any MCP-compatible client. CLI remains the final authority.",
  content: `## MCP setup

Rulebound ships an MCP server (\`@rulebound/mcp\`) so coding agents can query rules, get advisory planning feedback, and run deterministic checks during a task. MCP is in-agent feedback; the final authority remains \`rulebound check\` in the workspace or CI.

The MCP server reuses the same rule loader as the CLI: rules live in \`.rulebound/rules/\` of the workspace the agent is operating in. No separate config file is required for the agent to find them.

## Tools exposed

| Tool                     | Purpose                                                                 |
|--------------------------|-------------------------------------------------------------------------|
| \`run_deterministic_checks\` | Authoritative deterministic run over loaded \`checks:\` blocks. Use after writing code and before declaring success. |
| \`check_diff\`             | Authoritative deterministic run scoped to changed files from git diff / base / staged state. |
| \`get_repair_instructions\` | Structured repair-loop payload from deterministic failures.             |
| \`find_rules\`             | Find rules relevant to a task (advisory discovery; not authoritative).   |
| \`validate_plan\`          | Advisory plan check. Useful before coding, not the final pass/fail.      |
| \`check_code\`             | Advisory snippet-level check for quick feedback.                         |
| \`list_rules\`             | List all rules in the workspace, filtered by detected stack.             |
| \`validate_before_write\`  | Advisory/pre-write feedback before code lands on disk.                   |
| \`start_bugfix_workflow\`  | Create a bugfix boundary spec for behavior-preserving fixes.             |
| \`validate_bugfix_plan\`   | Check a bugfix plan against the stored boundary spec.                    |

Plan validation is advisory unless the project has plan-targeted deterministic rules. Code / diff checks are authoritative only through \`run_deterministic_checks\`, \`check_diff\`, the CLI, or CI.

## Claude Code

Add to your Claude Code MCP config (typically \`~/.claude/mcp.json\` or workspace-scoped \`.claude/mcp.json\`):

\`\`\`json
{
  "mcpServers": {
    "rulebound": {
      "command": "npx",
      "args": ["-y", "@rulebound/mcp"]
    }
  }
}
\`\`\`

In \`CLAUDE.md\`, instruct the agent to call MCP before implementing:

\`\`\`markdown
Before implementing any task, call \`rulebound.find_rules\` with the task
description. After producing a plan, call \`rulebound.validate_plan\` as advisory
feedback. After writing code, call \`rulebound.run_deterministic_checks\` or
\`rulebound.check_diff\`, then run \`rulebound check\` via the shell or CI when
available. Do not declare the task complete while Rulebound deterministic
checks are FAILED.
\`\`\`

## Cursor

Add to \`.cursor/mcp.json\` (or the global MCP settings in Cursor):

\`\`\`json
{
  "mcpServers": {
    "rulebound": {
      "command": "npx",
      "args": ["-y", "@rulebound/mcp"]
    }
  }
}
\`\`\`

Reference the tools from \`.cursor/rules.md\`:

\`\`\`markdown
For every task, call rulebound.find_rules first. Validate the plan with
rulebound.validate_plan as advisory feedback. After writing, call
rulebound.check_diff or rulebound.run_deterministic_checks and do not declare
success while deterministic checks are FAILED.
\`\`\`

## Amp

Amp picks up MCP servers from its agent config. Add the same block:

\`\`\`json
{
  "mcpServers": {
    "rulebound": {
      "command": "npx",
      "args": ["-y", "@rulebound/mcp"]
    }
  }
}
\`\`\`

Amp's tool list will then include the Rulebound tools alongside the built-in ones. Pair it with a project-level \`AGENTS.md\` directive to always run \`rulebound check\` before declaring success.

Recommended \`AGENTS.md\` instruction:

\`\`\`text
Do not declare task complete while Rulebound deterministic checks are FAILED.
\`\`\`

## Generic MCP client

Any MCP-compatible client can run \`@rulebound/mcp\` over stdio with the same command and args. The server speaks the standard MCP protocol — no custom transport required.

\`\`\`bash
npx -y @rulebound/mcp
\`\`\`

## Local development

When iterating on the MCP server inside this repo:

\`\`\`bash
pnpm --filter @rulebound/mcp build
node packages/mcp/dist/index.js
\`\`\`

Point your agent's MCP config at this absolute path with \`command: node\` and \`args: ["/abs/path/to/packages/mcp/dist/index.js"]\`.

## What MCP does not do

- It does not replace \`rulebound check\`. The deterministic CLI run is the authoritative pass/fail. MCP tools surface findings and rule context inside the agent loop.
- It does not run arbitrary commands without explicit configuration. Analyzer / command checks still require \`--allow-commands\` when invoked through the CLI.
- It does not learn or remember across sessions. Rules are reloaded from disk on every relevant call.
- It does not judge future scenario evidence with an LLM. When scenario evidence is added, MCP should pass deterministic scenario reports from external tools into the same evidence/check loop.

## Related

- [MCP Overview](/docs/mcp/overview) — deterministic vs advisory tools.
- [Deterministic Tools](/docs/mcp/deterministic-tools) — input/output shape.
`,
}

export default doc
