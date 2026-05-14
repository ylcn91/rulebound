# TypeScript (tsc) recipe

`tsc --noEmit` is the canonical TypeScript type check. Rulebound wraps it as an `analyzer` check that fails the rule when `tsc` exits non-zero. The check is exit-code-driven: there is no structured XML, so use `report_format: text` and let `pass_exit_codes` decide pass/fail.

Rulebound does NOT run `tsc` by default. Use `--allow-commands`, or run it in CI and let Rulebound see the exit-status report you write.

## Prerequisites

```bash
pnpm add -D typescript
# or
npm install -D typescript
```

A `tsconfig.json` at the project root or wherever you point `tsc` to.

## Rule check block

Two practical shapes.

A. Rulebound runs `tsc` directly (needs `--allow-commands`):

```yaml
checks:
  - type: analyzer
    id: tsc-noemit
    analyzer: tsc
    run: "pnpm tsc --noEmit"
    report: "reports/tsc.log"
    report_format: text
    pass_exit_codes: [0]
    severity: error
    message: "TypeScript compile errors. Run `pnpm tsc --noEmit` locally."
```

`report_format: text` parses nothing; the verdict comes from `pass_exit_codes`. Point `report:` at any file path — Rulebound only reads it when the command also writes to it. If `report` does not exist after the run, the rule returns `ERROR`, so redirect `tsc` output yourself:

```yaml
    run: "pnpm tsc --noEmit > reports/tsc.log 2>&1"
```

B. Use `type: command` for cases where you genuinely have no report file:

```yaml
checks:
  - type: command
    id: tsc-noemit
    run: "pnpm tsc --noEmit"
    pass_exit_codes: [0]
    severity: error
    message: "TypeScript compile errors."
```

Either form requires `--allow-commands` on the CLI.

## CI snippet

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: pnpm
- run: pnpm install --frozen-lockfile
- name: Type check
  run: |
    mkdir -p reports
    pnpm tsc --noEmit > reports/tsc.log 2>&1 || true
- uses: ./.github/actions/rulebound
  with:
    base: main
    format: github
    allow-commands: "false"
```

If you prefer to let Rulebound run `tsc` itself, drop the explicit step and pass `allow-commands: "true"`.

## Troubleshooting

`rulebound doctor`:

```
  ✓ analyzer:tsc           tsc: 1 report(s) ready
```

Tool not on PATH:

```
  ! analyzer:tsc           tsc: required tool not found on PATH (tsc, pnpm, npm, yarn)
```

Install `typescript` as a dev dependency, or install globally with `npm i -g typescript`.

`--allow-commands` required (because `run:` is set and the flag is off):

```
NOT_APPLICABLE  tsc-noemit  Analyzer with 'run' requires --allow-commands. Skipped: pnpm tsc --noEmit
```

Pass `--allow-commands` to `rulebound check`, or remove `run:` and produce the report in CI.

Report missing:

```
ERROR  tsc-noemit  Analyzer report not found: reports/tsc.log. Run the analyzer (or your build) that emits this report, then re-run rulebound check.
```

Create `reports/` and redirect `tsc` output into it.
