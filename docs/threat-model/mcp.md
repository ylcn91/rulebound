# Threat Model — MCP (`@rulebound/mcp`)

## Surface description

The MCP server exposes Rulebound's deterministic engine and advisory
matchers to AI coding agents over the Model Context Protocol stdio
transport (`packages/mcp/src/index.ts:424-427`). The server is launched
as a child process by the agent runtime (Claude Code, Cursor, Amp, or a
generic MCP client) and reads/writes JSON-RPC framed messages on
stdin/stdout.

Tools exposed:

- `find_rules`, `list_rules` — rule discovery.
- `validate_plan`, `check_code`, `validate_before_write` — **advisory**
  (keyword/semantic) matchers (`packages/mcp/src/index.ts:142-337`).
- `run_deterministic_checks`, `check_diff`, `get_repair_instructions` —
  **deterministic** engine, identical contract to `rulebound check`
  (`packages/mcp/src/index.ts:339-404`).
- `start_bugfix_workflow`, `validate_bugfix_plan` — bugfix spec
  workflow.

The deterministic tools call the same engine code as the CLI
(`runDeterministicChecks` in `packages/mcp/src/deterministic-tools.ts`),
so the CLI threat model (`cli.md`) applies in full to those tool calls.

## Trust boundary

**Inside:** the same trust boundary as the CLI (working tree, rules,
waivers, analyzer binaries). The MCP server inherits the agent
runtime's process privileges — typically the developer's local user.

**Outside:** the agent runtime and the agent's LLM provider. The MCP
server does **not** make outbound HTTP calls.

Boundary subtlety: the agent runtime is *more* privileged than the user
in one specific way — it accepts text the agent generates as
instructions, and an agent acting on prompt-injected content can
demand tool calls. So the MCP server must treat tool arguments as
potentially attacker-influenced even when the user is the operator.

## Assets behind the boundary

| Asset | Where | Why it matters |
| --- | --- | --- |
| Same set as CLI threat model | repository working tree | See `cli.md`. |
| Agent's trust in the verdict | agent transcript | An agent that mistakes an advisory `validate_plan` result for an authoritative deterministic verdict will ship broken code with a false-positive "PASS" log. |
| Bugfix spec files | `.rulebound/bugfixes/*.md` | An attacker could trick the agent into rewriting the spec mid-fix to silence regression scenarios. |

## Threats

| ID | STRIDE | Description | Mitigation | Residual | Linked task |
| --- | --- | --- | --- | --- | --- |
| MCP-T1 | Elevation / Tampering | `run_deterministic_checks` accepts `allow_commands` from the tool caller (`packages/mcp/src/index.ts:345,352`). An agent following prompt-injected instructions can pass `allow_commands: true` and trigger arbitrary command/analyzer execution inherited from CLI-T1. | Tool description states "Only enable in trusted local contexts" (`packages/mcp/src/index.ts:345`). No technical enforcement at the MCP layer — the engine itself only enforces opt-in, not opt-in-by-trusted-actor. | **High** in any setup where the agent runtime is hands-off (background agent, scheduled CI loop) and rules ship `command`/`analyzer` checks with non-curated `run` strings. The operator must curate the rule set. | AMP91-ENG-003, AMP91-MCP-002 (MCP error model hardening). |
| MCP-T2 | Spoofing (semantics) | The **advisory** tools (`validate_plan`, `check_code`, `validate_before_write`) return a `status` field and a `violations` array. An agent that does not read the tool description carefully can treat advisory `status: "PASSED"` (`packages/mcp/src/index.ts:152, 178`) as authoritative and skip the deterministic gate. | Tool descriptions explicitly state `ADVISORY plan check … This is NOT authoritative` (`index.ts:144`) and `Returns approved:true if clean` for `validate_before_write` (`index.ts:278`) is paired with a tool name that includes "before_write". `validate_plan` description names `run_deterministic_checks` and `check_diff` as the authoritative alternative. | Naming and copy carry the weight; tool authority cannot be enforced by the protocol. **Medium.** | AMP91-MCP-001 (CLI/MCP deterministic parity tests), AMP91-MCP-003 (agent-process signals). |
| MCP-T3 | Spoofing | Prompt injection inside source code, commit messages, or PR descriptions can instruct the agent to call `start_bugfix_workflow` with bogus `condition`/`postcondition`/`preservation_scenarios` (`packages/mcp/src/index.ts:42-83`) and then claim the bug is fixed. The spec then matches a downstream rule (`bugfix_spec_present`) and the deterministic gate passes. | The CLI/engine `bugfix.ts` validates spec structure (root cause, fix validation, preservation, scope sections must be present); an empty or fake spec fails. Regression-test enforcement (`regression_test_added` signal) requires a real diff hunk on a test file. | A sophisticated injection that writes a syntactically valid spec **and** a no-op test file would slip through both checks. The deterministic engine cannot tell intent. **Medium.** | AMP91-MCP-003 (agent-process signal contract). |
| MCP-T4 | Information disclosure | `run_deterministic_checks` returns the same `DeterministicReport` shape as the CLI (`packages/mcp/src/index.ts:354-356`). The report's `evidence.snippet` strings go through the same `redactSnippet` pipeline at the engine layer — **except** that the MCP tool currently returns the report via `JSON.stringify(result, null, 2)` directly without invoking `redactReportSnippets`. The redaction in CLI is applied at the printer site (`packages/cli/src/commands/check.ts`), not in the engine, so MCP output is not redacted. | The engine itself does not pre-redact; redaction is currently print-layer in the CLI. MCP `run_deterministic_checks` output may include unredacted snippets that the agent transcript then echoes. | **Medium**. The agent transcript is typically within the user's trust boundary but is often sent to the LLM provider. Operators concerned about provider-side leakage of source snippets should treat MCP output as raw. | AMP91-SEC-004 follow-up (move `redactReportSnippets` into a shared report-output helper in `@rulebound/shared` and call it from MCP tool returns). |
| MCP-T5 | DoS | MCP tools accept `changed_files` (`packages/mcp/src/index.ts:343, 387`) without an upper bound on array length. A 100,000-entry array would be evaluated by each rule's diff-evidence runner. | Engine-side runner iterates files; no explicit cap. CI/runtime context typically has a smaller diff. | **Low** because the typical caller is the agent or CI with bounded diffs. | n/a (acceptable for v0.1). |
| MCP-T6 | Repudiation | MCP tool calls are logged only to stderr (`console.error` in `packages/mcp/src/index.ts:430`). There is no per-tool-call audit trail to disk or to the server. | The agent runtime maintains its own transcript. The deterministic engine produces a fresh report on each call. | An operator forensically reconstructing "what did the agent see?" after an incident must rely on the agent transcript. **Low** for v0.1 self-hosted. | AMP91-SRV-007 (audit retention) is server-side, not MCP. |
| MCP-T7 | Elevation | MCP server runs as a child of the agent runtime. If the runtime escalates privileges (e.g. an MCP client launched by a root-owned daemon), `command`/`analyzer` checks via CLI-T1 inherit those privileges. | The MCP server itself does not request elevation. Operators run agent runtimes under their own user. | **Low** in standard setups; **High** if the MCP server is wired into a privileged service. Operator checklist below. | n/a. |

## Operator checklist

- Configure the MCP server to be launched as the developer's user, not
  as a service account with broader privileges.
- Tell the agent (via project-level instructions, e.g. `CLAUDE.md`)
  that **advisory** tool results are *not* sufficient to declare a
  task done. Always require a `run_deterministic_checks` PASS.
- Do **not** wire `allow_commands: true` into a default agent
  configuration. Require the agent to ask for permission, or only
  allow it in a curated bugfix branch.
- Keep `start_bugfix_workflow` writes (`.rulebound/bugfixes/*.md`)
  inside the repo so they go through code review.
- Set `RULEBOUND_MCP_ALLOW_COMMANDS` to never default to true in
  configuration management.

## Open questions

- Should the MCP server enforce a per-session toggle for
  `allow_commands` instead of accepting it on every tool call?
  Deferred to AMP91-ENG-003. Recommendation: add a startup flag and
  refuse the per-call argument when the flag is off.
- Should `redactReportSnippets` move from CLI print site into the
  engine `report-schema` so both CLI and MCP get the same treatment by
  default? Worth a Wave 4 follow-up.
- Bugfix workflow signatures: should `bugfix_spec_present` require a
  signed commit or a reviewer field? Deferred to AMP91-ENG-005.

## Reviewer sign-off

- Date:
- Reviewer:
- Notes:
