import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "workflows/self-healing",
  title: "Self-Healing Loop",
  description:
    "Run deterministic checks, hand machine-readable failure evidence to the agent, let it make the smallest fix, re-run the same checks. Deterministic re-run is the final judge — not an LLM explanation.",
  content: `## Self-healing

Self-healing in Rulebound means: run deterministic checks, hand machine-readable failure evidence to the agent, let the agent (or a scripted repair) make the smallest fix, re-run the same deterministic checks, stop when green or iteration cap is reached.

The **final pass/fail is always decided by deterministic checks re-running**, not by an LLM explanation. This is the deterministic-final-judge rule and it is non-negotiable for strict mode.

## CLI

\`\`\`bash
rulebound heal --max-iterations 3 --cmd "pnpm tsc --noEmit && pnpm lint --fix"
\`\`\`

| Flag                  | Default | Notes                                                      |
|-----------------------|---------|------------------------------------------------------------|
| \`--max-iterations\`    | \`3\`     | Clamped to \`[1, 10]\`                                       |
| \`--cmd\`               | none    | Shell command run between iterations (the "repair step")   |
| \`--allow-commands\`    | off     | Allow \`type: command\` / \`type: analyzer\` checks to exec    |
| \`--format\`            | \`pretty\`| \`pretty\` or \`json\`                                         |
| \`-d, --dir <path>\`    | auto    | Override rules directory                                   |

Loop semantics:

1. Run \`validateDeterministic\` against the loaded rules.
2. If the report status is not \`FAILED\`, exit 0 with \`status: "GREEN"\`.
3. On the final iteration with \`FAILED\` status, exit 1 with \`status: "EXHAUSTED"\`.
4. Otherwise: if \`--cmd\` is provided, run it; either way go to step 1.

When \`--cmd\` is omitted, \`heal\` simply re-runs the checks. That is useful when the agent is doing the repair externally between iterations and wants to poll the state.

## Repair JSON contract

\`rulebound check --format repair-json\` produces a compact, machine-readable failure report intended to be fed back to an agent.

\`\`\`json
{
  "status": "FAILED",
  "summary": { "total": 7, "pass": 5, "violated": 2, "notApplicable": 0, "error": 0, "blocking": 2 },
  "failures": [
    {
      "ruleId": "db.schema-needs-migration",
      "checkId": "schema-needs-migration",
      "source": "diff",
      "file": "packages/server/src/db/schema.ts",
      "reason": "Schema change without a corresponding migration.",
      "suggestedFix": "Add a SQL migration under packages/server/migrations/.",
      "rerun": "rulebound check --format repair-json"
    }
  ],
  "next": "Apply smallest fix per failure, rerun the same check."
}
\`\`\`

Each failure includes:

- \`ruleId\` and \`checkId\` — stable identifiers
- \`source\` — the deterministic source (\`ast\`, \`regex\`, \`diff\`, \`file\`, \`import-boundary\`, \`command\`, \`analyzer\`, \`agent-process\`)
- \`file\` and \`line\` when evidence has them
- \`evidence\` — full evidence block when present (snippet, exit code, analyzer report path, etc.)
- \`reason\` — the message a human would read
- \`suggestedFix\` when the rule provides one
- \`rerun\` — the exact command to verify the repair

If \`failures\` is empty, \`next\` is \`"GREEN — no repair needed"\`.

Waived findings are visible but kept out of the repair queue:

\`\`\`json
{
  "status": "PASSED_WITH_WARNINGS",
  "summary": { "total": 1, "pass": 0, "violated": 1, "notApplicable": 0, "error": 0, "blocking": 0, "waived": 1 },
  "failures": [],
  "waived": [
    {
      "ruleId": "deterministic.no-debugger",
      "checkId": "no-debugger",
      "file": "docs/example.ts",
      "reason": "Debugger statement found.",
      "waiverReason": "Documentation fixture only."
    }
  ],
  "expiredWaivers": [],
  "next": "GREEN — no repair needed"
}
\`\`\`

An expired waiver re-enters \`failures[]\`; agents must fix it or ask the owner to renew the waiver explicitly.

## Agent loop

A correct agent loop using repair JSON:

1. Run \`rulebound check --format repair-json\` (with \`--allow-commands\` if needed).
2. If \`status\` is \`PASSED\`, stop.
3. Pick the first failure. Read \`evidence\`, \`file\`, \`line\`, \`reason\`, \`suggestedFix\`.
4. Make the **smallest** change that addresses that failure. Do not refactor adjacent code.
5. Re-run the exact \`rerun\` command.
6. If still failing on the same \`checkId\`, do not retry blindly — surface the failure to the user.
7. Stop after the configured max iterations.

The agent must not:

- bypass tests or checks
- mark a task complete while deterministic checks are \`FAILED\`
- declare success based on its own explanation — only on a re-run that returns \`PASSED\` (or \`PASSED_WITH_WARNINGS\`, if warnings are acceptable in that workflow)

## MCP integration

When agents drive the loop via MCP, \`validateDeterministic\` accepts \`agentSignals\` — flags like \`findRulesCalled\`, \`validatePlanCalled\`, \`bugfixSpecPath\`, \`regressionTestAdded\`. These let \`type: agent-process\` checks deterministically enforce that the agent followed the required workflow.

See [MCP Setup](/docs/mcp/setup) for tool wiring.

## What self-healing is not

- It is not an autonomous "fix everything" loop. The agent makes one focused change per iteration.
- It is not LLM-judged. The LLM is allowed to propose a fix and explain it, but only the deterministic re-run decides if the fix worked.
- It is not a substitute for human review on irreversible changes (migrations, deletions, security-sensitive code).
- Scenario evidence is planned. Once implemented, repairs must re-run the same deterministic scenario report/check; an LLM explanation of the scenario is never enough.

## Related

- [\`rulebound heal\`](/docs/cli/heal) — the CLI driver.
- [\`rulebound check\`](/docs/cli/check) — the deterministic engine that re-runs each iteration.
- [Bugfix Workflow](/docs/workflows/bugfix-workflow) — boundary spec for behavior-preserving fixes.
- [MCP Deterministic Tools](/docs/mcp/deterministic-tools) — agent-side surface for the repair loop.
`,
}

export default doc
