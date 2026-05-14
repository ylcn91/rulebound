# Rulebound GitHub Action

Rulebound ships a reusable composite GitHub Action that runs the deterministic
`rulebound check` command in CI and surfaces violations as GitHub annotations
and a step summary.

The action lives at `.github/actions/rulebound/action.yml` in this repository.
Downstream repositories typically consume it in one of two ways:

1. Copy the action directory into their own repo and reference it locally with
   `uses: ./.github/actions/rulebound`.
2. Reference it directly from this repo (`uses: rulebound/rulebound/.github/actions/rulebound@<ref>`)
   once the repository is published.

Example workflows are provided under
`.github/workflows/examples/`. They use `workflow_dispatch` only so they never
run automatically in this repo — copy them into your own repo and adjust the
trigger to `pull_request` / `push`.

## Inputs

| Input                              | Default  | Description                                                                                                                                                          |
| ---------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rules-dir`                        | `""`     | Path to the rules directory. Empty triggers auto-detection (looks for `.rulebound/rules`, `rules/`, etc.).                                                           |
| `base`                             | `main`   | Base branch used to derive the diff context (`--base`). Diff-evidence checks scope their evaluation to changed files.                                                |
| `format`                           | `github` | Output format: `pretty`, `json`, `github`, `repair-json`, `sarif`, `pr-markdown`.                                                                                    |
| `pr-markdown-summary`              | `true`   | Append a `pr-markdown` evidence report to `$GITHUB_STEP_SUMMARY`. Triggers a second `rulebound check` invocation — see "Double-run trust boundary" below.            |
| `rerun-command-checks-for-summary` | `false`  | Opt in to re-running command/analyzer checks during the summary pass when `allow-commands=true`. Off by default to avoid expensive or side-effectful double-runs.    |
| `allow-commands`                   | `false`  | Allow Rulebound to execute `command` / `analyzer` checks. Required for analyzer presets like PMD, Checkstyle, ESLint.                                                |
| `fail-on-advisory`                 | `false`  | When `true`, exit with code `3` if only advisory violations are present. Off by default — advisory findings only warn.                                               |
| `version`                          | `latest` | npm version selector for `@rulebound/cli`.                                                                                                                           |
| `node-version`                     | `20`     | Node.js version installed before running Rulebound.                                                                                                                  |
| `working-directory`                | `.`      | Working directory used to invoke `rulebound`.                                                                                                                        |

## Outputs

| Output      | Description                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `exit-code` | Raw exit code returned by `rulebound check`.                                                        |
| `status`    | `passed` (exit 0), `failed` (exit 1 or 3), or `error` (anything else, typically a config problem).  |

The action also appends a short summary block to `$GITHUB_STEP_SUMMARY` so the
status is visible on the PR's Checks tab without inspecting the raw logs.

`format: github` is the canonical CI path because it emits deterministic-only
GitHub annotations by default. Use `format: pr-markdown` when you want a
sectioned PR evidence report instead of annotation lines.

## Exit codes

Matches the CLI contract (`packages/cli/src/commands/check.ts`):

| Code | Meaning                                                                             |
| ---- | ----------------------------------------------------------------------------------- |
| `0`  | All deterministic checks passed.                                                    |
| `1`  | One or more deterministic violations blocked the run. The PR check fails.           |
| `2`  | Configuration or runtime error (no rules found, invalid arguments, etc.).           |
| `3`  | Advisory-only violations present and `--fail-on-advisory` was set. The check fails. |

## When to enable `--fail-on-advisory`

Off by default. Enable it once:

1. Your rule set has a healthy ratio of deterministic checks (file/diff/regex/
   analyzer) and advisory findings have been triaged.
2. You are willing to block PRs on advisory signals (keyword/semantic/LLM-sourced
   findings flagged by Rulebound as non-deterministic).

For an introductory rollout, keep it `false` and rely on exit code `1` so only
deterministic blockers fail the PR.

## When to enable `--allow-commands`

Required whenever rules contain `type: command` or `type: analyzer` checks. The
guard is opt-in so untrusted rule sets cannot execute arbitrary commands by
default. Enable it for:

- TypeScript projects running `tsc --noEmit`, `eslint`, `dependency-cruiser`.
- Java projects running `mvn pmd:check`, `mvn checkstyle:check`,
  `mvn spotbugs:check`, ArchUnit via Surefire.
- Security pipelines running `semgrep`, `gitleaks`, etc.

## Double-run trust boundary (`pr-markdown-summary` + `allow-commands`)

The action runs `rulebound check` once in the configured `format` (default
`github`, for annotations). When `pr-markdown-summary=true` (default), it then
runs `rulebound check` a second time with `--format pr-markdown` and appends
the output to `$GITHUB_STEP_SUMMARY`.

Two checks are necessary because the CLI renders one format per invocation. For
pure file/regex/diff/ast checks this is cheap and side-effect free — the second
run is observationally identical to the first.

It is **not** safe when `allow-commands=true`. Command and analyzer checks
(PMD, Checkstyle, SpotBugs, ESLint, semgrep, gitleaks, ...) shell out to
external tools that may be expensive, may write to disk, or may emit telemetry.
Running them twice per CI job wastes minutes and can produce inconsistent
artifacts.

The action handles this as follows:

| `pr-markdown-summary` | `allow-commands` | `rerun-command-checks-for-summary` | Second check runs? |
| --------------------- | ---------------- | ---------------------------------- | ------------------ |
| `false`               | any              | any                                | no                 |
| `true`                | `false`          | any                                | yes (safe)         |
| `true`                | `true`           | `false` (default)                  | **no** — summary is skipped with a one-line notice |
| `true`                | `true`           | `true`                             | yes (explicit opt-in) |

When the summary is skipped, the action still appends the short status block
(status, exit code, format, etc.) — only the long pr-markdown evidence report
is omitted. If you want the full report and accept the double execution cost,
set `rerun-command-checks-for-summary: 'true'`.

A future change may switch the action to render annotations and markdown from
a single JSON run, eliminating the trade-off. Until then, this input is the
explicit knob.

## SARIF output

`--format sarif` emits a minimal SARIF 2.1.0 document on stdout, suitable for
GitHub code scanning via `github/codeql-action/upload-sarif`. The shape is:

- `runs[].tool.driver.name`: `rulebound`.
- `runs[].tool.driver.rules`: deduplicated list of rule IDs that produced
  findings, with `defaultConfiguration.level` derived from `blocking`.
- `runs[].results`: one entry per violated or errored check. `level` is `error`
  for blocking findings, `warning` for non-blocking, `note` otherwise. Each
  result carries `properties.source`, `properties.checkId`,
  `properties.confidence`, and `properties.suggestedFix` where present.

Because the action prints SARIF to stdout, capture it via the CLI directly when
you need a file (see `example-rulebound-security.yml`):

```bash
rulebound check --format sarif --base main > rulebound.sarif
```

Then upload with `github/codeql-action/upload-sarif@v3`.

> Note: the SARIF emitter is intentionally minimal. Helpful fields (rule
> descriptions, fingerprints for de-duplication across runs, fix suggestions as
> SARIF `fixes`) are future enhancements. File an issue if you need them.

## Example workflows

See `.github/workflows/examples/`:

- `example-rulebound-basic.yml` — minimal Rulebound run on PRs.
- `example-rulebound-typescript.yml` — adds Node + pnpm/npm install, enables
  `allow-commands` for `tsc`/`eslint` analyzer checks.
- `example-rulebound-java.yml` — installs JDK, primes Maven cache, enables
  `allow-commands` so PMD/Checkstyle/SpotBugs/ArchUnit checks run.
- `example-rulebound-security.yml` — chains gitleaks + semgrep + Rulebound,
  uploads Rulebound SARIF to GitHub code scanning.

## Local equivalent

To reproduce the action locally:

```bash
npm install -g @rulebound/cli@latest
rulebound check --format github --base main
```

When dogfooding inside this repository before publishing, use the built CLI:

```bash
pnpm --filter @rulebound/cli build
node packages/cli/dist/index.js check --format github --base main
```

For a PR-ready evidence summary instead of GitHub annotations:

```bash
rulebound check --format pr-markdown --base main
```

Exit codes and output match the CI run.

### Example `pr-markdown` excerpt

Real output from `rulebound check --format pr-markdown` on this repository
(status will vary; this is the all-pass shape):

```markdown
## rulebound check — **PASSED**

- **Pass:** 3
- **Violated:** 0
- **Blocking:** 0
- **Waived:** 0
- **Not applicable:** 4
- **Errors:** 0
- **Advisory-only rules:** 0

### Deterministic blockers

_None._

### Deterministic warnings

_None._

### Waivers applied

_None._

### Analyzer findings

_No analyzer checks ran._

### Repair

All deterministic checks passed.
```

The report keeps deterministic blockers, deterministic warnings, advisory-only
rules, waivers, and analyzer findings in distinct sections so a waived finding
can never be confused with a pass and an advisory-only rule never appears as a
blocker. The full set of section shapes is covered by
`packages/cli/src/__tests__/pr-markdown.snapshot.test.ts`.
