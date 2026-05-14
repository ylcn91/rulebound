# Quickstart

Goal: get Rulebound running deterministic checks on your repo in under 10 minutes.

This walkthrough installs the CLI, seeds deterministic rule packs, runs
`rulebound check`, fixes one deliberate failure, and wires the result into CI.
It does not require the server, dashboard, gateway, or hosted SaaS.

## 1. Install

```bash
npm install -g @rulebound/cli
# or
pnpm add -g @rulebound/cli
```

Verify:

```bash
rulebound --version
```

## 2. Initialize a project

From the root of your repo, start with the `starter` pack — pure
deterministic, no external analyzers required, no `--allow-commands`:

```bash
rulebound init --pack starter --no-hook
```

This creates:

```
.rulebound/
  config.json
  rules/
    deterministic/no-hardcoded-secrets.md
    deterministic/no-debugger.md
    deterministic/schema-needs-migration.md
```

Once `starter` is green, layer on more curated packs as needed:

```bash
# Stack-specific deterministic packs:
rulebound init --pack typescript --pack security --pack agent-workflow

# Opt-in analyzer packs (need external tools + --allow-commands):
rulebound init --pack analyzer-typescript
rulebound init --pack analyzer-java
rulebound init --pack analyzer-security
```

For demos or backwards-compatible examples, `--examples` still works but may
emit analyzer warnings until the matching toolchain is installed:

```bash
rulebound init --examples
```

If you also want to import rules from existing agent files (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`):

```bash
rulebound init --examples --migrate
```

## 3. Check the environment

```bash
rulebound doctor
```

`doctor` reports:

- whether a `.rulebound/rules` directory was found
- how many loaded rules have deterministic `checks:` blocks vs are advisory-only
- detected project stack (e.g. `node`, `java`, `python`)
- git repo presence (required for `diff-evidence`)
- which analyzers are on PATH (`pnpm`, `git`, `java`, `mvn`, `python`, `go`, `cargo`, `eslint`, `semgrep`, ...)

Fix any `fail` items before adding command/analyzer rules that depend on local
toolchains.

## 4. Run deterministic checks

```bash
rulebound check
```

Output (`pretty`):

```
rulebound check — PASSED
  3 pass · 0 violated · 0 n/a · 0 error · 0 blocking
```

Other formats:

```bash
rulebound check --format json
rulebound check --format github          # GitHub annotations for CI
rulebound check --format repair-json     # Machine-readable repair plan
```

The check report is the authoritative pass/fail surface. Advisory commands such
as `rulebound validate`, `rulebound diff`, and `rulebound review` are useful for
planning and review, but they are not the deterministic CI gate.

## 5. Restrict to current diff

`diff-evidence` checks are only meaningful in the context of a changeset.

```bash
rulebound check --staged                 # against staged files
rulebound check --base main              # against main...HEAD
rulebound check --diff                   # against working-tree diff
```

## 6. Add a deterministic rule

Create `.rulebound/rules/db/schema-needs-migration.md`:

```markdown
---
title: DB schema changes require migration
category: architecture
severity: error
modality: must
checks:
  - type: diff-evidence
    id: schema-needs-migration
    when_changed:
      - "packages/server/src/db/schema.ts"
    require_changed:
      - "packages/server/migrations/**/*.sql"
    message: "Schema change without a corresponding migration."
---

Any change to schema.ts must include at least one SQL migration.
```

Modify `schema.ts`, run `rulebound check --staged`, and confirm it fails with `VIOLATED`.

That failure is the core Rulebound loop: the agent changed a protected file, but
the diff did not include the required evidence. Add the missing migration and
re-run the same command; the final pass/fail comes from the deterministic
re-run, not from an LLM explanation.

### Deliberate fail/fix loop

If your repo does not have a DB schema path, use a simple command/test evidence
rule instead. Create `.rulebound/rules/cli-command-needs-test.md`:

```markdown
---
title: CLI command changes require tests
category: testing
severity: error
modality: must
checks:
  - type: diff-evidence
    id: cli-command-needs-test
    when_changed:
      - "packages/cli/src/commands/**/*.ts"
    require_changed:
      - "packages/cli/src/**/*.test.ts"
    message: "CLI command changed without a matching CLI test change."
---

Command behavior must be covered by a focused CLI test.
```

Then:

```bash
# 1. Change a CLI command file, but do not change a test.
rulebound check --staged
# -> FAILED / VIOLATED: cli-command-needs-test

# 2. Add or update the focused CLI test.
rulebound check --staged
# -> PASSED (or PASSED_WITH_WARNINGS if non-blocking findings remain)
```

## 7. Add to CI

GitHub Actions example:

```yaml
name: rulebound
on: [pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install -g @rulebound/cli
      - run: rulebound check --base origin/${{ github.base_ref }} --format github
```

If you vendor Rulebound's composite action in your repo, the equivalent is:

```yaml
- uses: ./.github/actions/rulebound
  with:
    base: main
    format: github
```

See [ci-github-action.md](ci-github-action.md) for all inputs, the SARIF
upload recipe, and the `pr-markdown-summary` / `--allow-commands` double-run
trust boundary.

Exit codes:

| Code | Meaning |
|------|---------|
| 0 | Pass |
| 1 | Deterministic violation |
| 2 | Config/runtime error |
| 3 | Advisory-only (with `--fail-on-advisory`) |

## 8. Wire MCP for the agent

See [mcp-setup.md](mcp-setup.md). With MCP connected, the agent can call
`find_rules` and advisory `validate_plan` early, then use authoritative
`run_deterministic_checks`, `check_diff`, and `get_repair_instructions` before
declaring the task complete. The CLI remains the final authority.

## What not to do

- Do not rely on `rulebound review`, `rulebound validate`, keyword matching,
  semantic matching, or LLM commentary as the final pass/fail. They are
  advisory unless you explicitly opt into `--fail-on-advisory`.
- Do not enable `type: command` or analyzer `run:` checks on untrusted rules.
  Use `--allow-commands` only in trusted repos and CI contexts.
- Do not route first-run users through the dashboard, server, or gateway. They
  are optional/advanced surfaces; `rulebound check` is the value moment.

## Next steps

- [deterministic-rule-schema.md](deterministic-rule-schema.md) — full check reference.
- [analyzer-orchestration.md](analyzer-orchestration.md) — wire PMD/Checkstyle/SpotBugs/ESLint/Semgrep.
- [self-healing.md](self-healing.md) — repair loop contract.
- [bugfix-workflow.md](bugfix-workflow.md) — bugfix boundary / postcondition / preservation.
