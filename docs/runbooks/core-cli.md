# Runbook — Core CLI (`@rulebound/cli`)

## Scope

This runbook covers installing and operating `rulebound` (the CLI) in
local development, in CI, and as the deterministic gate inside an AI
coding agent's loop via MCP. The CLI is the **canonical** Rulebound
surface; everything else is optional.

## Pre-deploy checklist

| Item | Required | Notes |
| --- | --- | --- |
| Node.js 22.x | Yes | `node --version` should report `v22.x`. CLI is published as ESM. |
| pnpm 10.x | Recommended for local dev | `pnpm --version` |
| Git available in `$PATH` | Yes | `diff-evidence` checks shell out to `git diff` (`packages/cli/src/lib/git-diff.ts`). |
| Project-local rules directory | Yes | `.rulebound/rules/**/*.md`. Bootstrap with `rulebound init --pack starter --no-hook`. |
| Analyzer binaries (PMD, ESLint, etc.) | Conditional | Only if a rule uses `type: analyzer`. Run `rulebound doctor`. |
| `--allow-commands` opt-in posture | Optional | See "Allow-commands posture" below. |
| Waivers file | Optional | `.rulebound/waivers.yaml` if used; reviewed per AMP91-ENG-005. |

## Deploy steps

### Local install (developer machine)

```sh
npm install -g @rulebound/cli@<version>
# or, in a project:
pnpm add -D @rulebound/cli@<version>
```

Then:

```sh
rulebound --version
rulebound doctor
rulebound init --pack starter --no-hook
rulebound check
```

The expected outcome of `rulebound check` on a fresh starter pack is
PASS (exit 0). If `doctor` reports missing toolchains for an analyzer
pack, install the analyzer or remove the rule.

### CI install (GitHub Actions)

Use the reusable composite action:

```yaml
- uses: rulebound/rulebound/.github/actions/rulebound@v0.1
  with:
    format: github
    fail-on-advisory: false
    allow-commands: false
```

See [`docs/ci-github-action.md`](../ci-github-action.md) for inputs.
Required permissions: `contents: read`, `pull-requests: write`
(annotations + summary).

For non-GitHub CI, install the CLI directly:

```sh
npm install -g @rulebound/cli@<version>
rulebound check --format json > rulebound.json
```

Then post-process `rulebound.json` against your CI's annotation API.

### MCP server install (agent runtime)

```sh
# stdio launch — Claude Code, Cursor, Amp, generic MCP clients
npx -y @rulebound/mcp
```

Or wire as an MCP server in the agent's config; see
[`docs/mcp-setup.md`](../mcp-setup.md) for client-specific snippets.

## Allow-commands posture

`--allow-commands` enables `type: command` and `type: analyzer` checks
whose `run` strings are executed via `/bin/sh -c` in the engine
(`packages/engine/src/checks/runners/command.ts:77`). This is **opt-in
only**; the CLI never defaults it on.

Recommended posture:

- **Local dev:** allow per-invocation when the developer needs an
  analyzer rerun. Do not default it in shell aliases.
- **CI:** prefer "pre-analyzer + read report" — run ESLint / PMD / etc.
  in a CI step *before* Rulebound, and let Rulebound read the report
  file via `type: analyzer` with no `run`. This keeps `--allow-commands`
  off and avoids double-running.
- **MCP / agent:** never default `allow_commands: true`. If a rule pack
  requires it, document why and curate the rule set.

Threats are detailed in [`docs/threat-model/cli.md`](../threat-model/cli.md)
(CLI-T1, CLI-T3).

## Post-deploy verification

```sh
rulebound check --format json | jq '.summary'
```

Expected (on a green tree):

```json
{
  "rulesTotal": <int>,
  "rulesEvaluated": <int>,
  "blockingViolations": 0,
  "advisoryFindings": 0
}
```

Exit code matrix (per AMP91-CLI-002):

| Exit code | Meaning |
| --- | --- |
| 0 | All deterministic checks PASS. |
| 1 | One or more deterministic checks VIOLATED (blocking). |
| 2 | Config or runtime error (bad rules, missing waivers file). |
| 3 | Advisory findings present **and** `--fail-on-advisory` set. |

Smoke check the install:

```sh
rulebound doctor    # toolchain + analyzer + rule schema audit
rulebound --help    # canonical command list (matches docs)
```

## Rollback procedure

The CLI is a stateless tool. Rollback = downgrade.

```sh
npm install -g @rulebound/cli@<previous-version>
rulebound --version  # verify
```

If the project's `.rulebound/rules/` has rules that depend on a newer
engine schema, the CLI will return `ERROR` results (exit code 2) rather
than silently producing bad output. Roll back rules in lock-step with
the CLI when this happens.

`rulebound check` produces no persistent state, so there is nothing to
clean up other than committing or discarding the rules directory
changes.

## Operational notes

- The CLI is fully offline by default. No telemetry, no phoning home.
  `rulebound registry install <pkg>` is the only command that touches
  the network; it uses the user's npm client.
- Output formats (`pretty`, `json`, `github`, `sarif`, `pr-markdown`,
  `repair-json`) all redact well-known secret shapes in
  `evidence.snippet` (AMP91-SEC-004). They do **not** redact analyzer
  stdout/stderr captured in `evidence.stdout/stderr` — be cautious
  echoing those to public CI logs.
- For long-running CI jobs, set a runner-level timeout matching your
  analyzer pack's slowest check (default `command.timeout_ms` is 120 s;
  `analyzer.timeout_ms` is 600 s).

## Cross-references

- [`docs/threat-model/cli.md`](../threat-model/cli.md)
- [`docs/deterministic-rule-schema.md`](../deterministic-rule-schema.md)
- [`docs/release-gate.md`](../release-gate.md)
- [`docs/runbooks/secret-rotation.md`](./secret-rotation.md) — CLI does
  not hold persistent secrets, but `rulebound registry install`
  consumes `NPM_TOKEN`.
