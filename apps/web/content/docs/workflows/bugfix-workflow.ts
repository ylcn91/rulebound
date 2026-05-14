import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "workflows/bugfix-workflow",
  title: "Bugfix Workflow",
  description:
    "Rulebound forces the bugfix boundary to be explicit — bug condition C, postcondition P, preservation scenarios, scope — so an agent cannot silently refactor while fixing a bug.",
  content: `## Bugfix workflow

A bugfix is a behavior-preserving change. The agent's job is to fix one declared bug without silently refactoring or expanding scope. Rulebound forces that boundary to be explicit.

## The model

A bugfix is described by:

- **Bug condition \`C\`** — the precise condition under which the bug occurs.
- **Postcondition \`P\`** — what must be true after the fix.
- **Preservation scenarios for \`not C\`** — the behaviors that must remain unchanged.
- **Scope** — the files / functions the fix is allowed to touch.

\`C\`, \`P\`, and the preservation scenarios should each be checkable. Preferably each gets a regression test.

## CLI

### Create a spec

\`\`\`bash
rulebound bugfix start --summary "Deleting a user fails when billing profile is missing"
\`\`\`

This writes a Markdown spec under \`.rulebound/bugfixes/\` with a slugged filename. Open it and fill in:

- bug condition \`C\`
- postcondition \`P\`
- preservation scenarios
- scope

### Validate a plan

\`\`\`bash
rulebound bugfix validate \\
  --spec .rulebound/bugfixes/deleting-a-user-fails-when-billing-profile-is-missing.md \\
  --plan "Add a null guard in delete handler. Add fix test and a preservation test for the happy path."
\`\`\`

Validation fails when the plan misses the boundary (e.g. proposes a wider refactor, omits a regression test, or does not address \`P\`).

### Plan from a file

\`\`\`bash
rulebound bugfix validate --spec ... --plan-file plan.md --format json
\`\`\`

## Pairing with deterministic checks

Use \`agent-process\` checks to require that bugfix branches actually went through the spec workflow:

\`\`\`yaml
checks:
  - type: agent-process
    id: bugfix-spec-required
    require: bugfix_spec_present
    severity: error
    message: "fix/** branches require a bugfix spec."

  - type: agent-process
    id: regression-test-required
    require: regression_test_added
    severity: error
    message: "Bugfix must include a regression test."
\`\`\`

These signals are provided by the MCP layer (\`bugfix_spec_present\`, \`regression_test_added\`). Outside MCP they will fail, so scope these rules to bugfix branches or run them only when MCP is active.

A complementary \`diff-evidence\` check can require a test change on \`fix/**\`:

\`\`\`yaml
checks:
  - type: diff-evidence
    id: bugfix-needs-test
    branch_matches: "^fix/.+"
    require_changed:
      - "**/*.test.ts"
      - "**/*.spec.ts"
      - "**/test_*.py"
    severity: error
    message: "Bugfix branch must include at least one test change."
\`\`\`

## Waivers

Waivers exist for legitimate exceptions (docs-only fixes, environment-only changes). A waiver must be explicit, scoped, and time-bounded — never a silent bypass.

A waiver in a bugfix spec looks like:

\`\`\`yaml
waiver:
  rule: bugfix.regression-test-required
  reason: "docs-only fix"
  owner: "@alice"
  expires: "2026-06-01"
\`\`\`

Runtime waivers live in \`.rulebound/waivers.yaml\` and must include \`reason\`, \`owner\`, and \`expires\`. They downgrade a matching deterministic violation from blocking to advisory without hiding it. Expired or malformed waivers fail closed. See [Waivers](/docs/rules/waivers) for the authoritative schema.

## What this workflow is for

- Preventing scope creep on agent-generated patches.
- Producing an auditable record of what was meant to change.
- Forcing regression-test evidence to live in the diff.

## What it is not

- It is not a project-management tool. It is one Markdown spec per bugfix, version-controlled with the code.
- It is not enforced retroactively. A fix that has already shipped without a spec stays as-is.
- It is not an LLM judge. The spec is the declared contract; deterministic checks verify the diff against it.

## Related

- [Self-Healing Loop](/docs/workflows/self-healing) — repair loop after a bugfix lands.
- [Deterministic Checks](/docs/rules/deterministic-checks) — \`agent-process\` and \`diff-evidence\` reference.
- [MCP Setup](/docs/mcp/setup) — the layer that emits \`bugfix_spec_present\` and \`regression_test_added\` signals.
`,
}

export default doc
