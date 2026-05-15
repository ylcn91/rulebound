# Agent-process signals

`type: agent-process` checks let a rule deterministically verify that an
AI coding agent followed the required workflow before producing a change.
Unlike file/regex/diff checks, these checks consume *external* signals
that are passed into the engine via `agentSignals` — typically by the MCP
server as part of a tool-use loop.

This document is the canonical taxonomy. It pairs with:

- `packages/engine/src/checks/types.ts` — the `AgentProcessCheck.require` enum.
- `packages/engine/src/checks/deterministic.ts` — `AgentSignals` interface
  and the signal-to-flag mapping.
- `docs/bugfix-workflow.md` — how `bugfix_spec_present` and
  `regression_test_added` fit into the `fix/**` flow.

## Signal taxonomy

Four canonical signals are recognised today. Adding a fifth is a breaking
change: it requires a `SCHEMA_VERSION` bump, a new entry in
`AgentProcessCheck.require`, a matching field on `AgentSignals`, and an
update to this doc.

| Signal name (`require`)      | Set by                                                  | What it asserts                                                                       |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `find_rules_called`          | MCP tool `find_rules` invocation                        | The agent looked up applicable rules before proposing a change.                       |
| `validate_plan_called`       | MCP tool `validate_plan` invocation                     | The agent ran its proposed plan through the advisory validator.                       |
| `bugfix_spec_present`        | MCP `bugfix_spec_register` or filesystem detection       | A bugfix spec exists for the current change (typical on `fix/**` branches).           |
| `regression_test_added`      | Diff inspection by MCP / CLI                            | The diff under review includes at least one new or modified test.                      |

### `AgentSignals` shape (engine input)

```ts
interface AgentSignals {
  findRulesCalled?: boolean
  validatePlanCalled?: boolean
  bugfixSpecPath?: string       // non-empty string is truthy
  regressionTestAdded?: boolean
}
```

A signal is **satisfied** when the corresponding `AgentSignals` field is
truthy at the moment `validateDeterministic` is invoked. Anything else
(undefined, false, empty string) counts as missing.

## Missing-signal behaviour

The behaviour is deliberately split by *who is driving the check*:

### CLI invocation (no MCP loop)

When `rulebound check` runs from the terminal or CI without an MCP agent,
`agentSignals` is `undefined`. Every `agent-process` check therefore
evaluates as VIOLATED.

To prevent noise on branches where the agent loop isn't running, rules
**must** be scoped by branch (`branch_matches`) or by paired diff-evidence
checks. The standard pattern is:

```yaml
checks:
  - type: diff-evidence
    id: bugfix-spec-present
    branch_matches: '^fix/'
    require_changed:
      - ".rulebound/bugfixes/*.md"
    severity: error
  - type: agent-process
    id: bugfix-spec-agent-signal
    require: bugfix_spec_present
    severity: warning   # advisory by design
```

The `diff-evidence` check is the deterministic blocker; the
`agent-process` check is a *warning-severity* advisory that becomes
informative only when the MCP loop runs.

See `packages/cli/rules/examples/deterministic/bugfix-needs-spec.md` for
the production example.

### MCP invocation (agent loop active)

When the MCP server invokes the engine, it passes the live `agentSignals`
object. Checks now reflect the agent's real behaviour:

- Missing `find_rules_called` is a real failure to follow process.
- Missing `regression_test_added` on a `fix/**` branch is a real omission.

In both modes, severity from the rule (`error` vs `warning`) drives
whether the result is blocking or advisory.

## Behaviour matrix

| Branch / driver         | `agent-process` check severity | `agentSignals` available? | Result                                              |
| ----------------------- | ------------------------------ | ------------------------- | --------------------------------------------------- |
| Default branch + CLI    | warning                        | no                        | VIOLATED, **non-blocking** (advisory warning)        |
| Default branch + CLI    | error                          | no                        | VIOLATED, **blocking** — anti-pattern, gate by branch |
| `fix/**` + CLI          | warning                        | no                        | VIOLATED, non-blocking — agent reminder for reviewer |
| `fix/**` + CLI          | error                          | no                        | VIOLATED, blocking — strong gate; needs MCP or waiver |
| `fix/**` + MCP, signal present | any                     | yes                       | PASS                                                |
| `fix/**` + MCP, signal absent  | error                   | yes                       | VIOLATED, blocking — agent missed required step      |

### Pattern: pair every `agent-process` check with a deterministic anchor

Because `agent-process` checks see different signals depending on the
driver, every rule that uses them should also carry a deterministic
diff/file check that produces the same verdict from the diff alone. Then:

- The diff-evidence check is the **gate**.
- The agent-process check is an **observability signal** for the MCP loop.

## Suppressing noise on non-fix branches

For rules that genuinely only apply on `fix/**`:

```yaml
checks:
  - type: agent-process
    id: regression-test-required
    require: regression_test_added
    severity: warning
```

Without a branch scope, this fires on every branch. Authors should add
`branch_matches: '^fix/'` to the paired `diff-evidence` check that gates
this rule. The `agent-process` check itself does not currently accept a
`branch_matches` field (see open question).

## Open questions

1. **Branch scope on `agent-process` directly.** Today, branch scoping
   is provided only by `diff-evidence`. We could add `branch_matches` to
   `AgentProcessCheck` so rules can be self-gating. Pending: a use case
   that can't be served by pairing with a diff-evidence check.
2. **Signal expiry / freshness.** All signals are point-in-time booleans.
   For long agent sessions, a stale `find_rules_called` from hours ago is
   indistinguishable from a fresh one. Not in scope for v0.1.

## Acceptance tests

`packages/engine/src/__tests__/agent-process-signals.test.ts` pins the
contract above with fixtures for:

- default branch, no MCP → advisory warning, non-blocking
- `fix/**` branch with signal absent → advisory warning, non-blocking
- `fix/**` branch with signal present → PASS
- error-severity check on default branch (anti-pattern) → blocking failure
