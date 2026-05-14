# Semgrep recipe

Semgrep is a pattern-based static analyzer with SARIF output. Rulebound consumes that SARIF directly and reports each result as an `analyzer` finding with file, line, rule id and severity.

Rulebound does NOT run Semgrep by default. Run it in CI (the usual pattern) and let Rulebound read the SARIF, or pass `--allow-commands` to let Rulebound invoke it.

## Prerequisites

```bash
pip install semgrep
# or
brew install semgrep
```

A Semgrep config: a registry pack (`p/ci`, `p/owasp-top-ten`, etc.) or a local YAML ruleset.

## Rule check block

```yaml
checks:
  - type: analyzer
    id: semgrep-ci
    analyzer: semgrep
    run: "semgrep --config p/ci --sarif --output reports/semgrep.sarif ."
    report: "reports/semgrep.sarif"
    report_format: sarif
    fail_on_severity: warning
    severity: error
    message: "Semgrep reported findings. Triage them or document an explicit waiver."
```

Severity mapping (from SARIF `level`):

| SARIF `level` | Rulebound severity |
|---------------|--------------------|
| `error`       | `error`            |
| `warning` (default) | `warning`    |
| `note`        | `info`             |

`fail_on_severity: warning` blocks the rule for warnings and errors; `fail_on_severity: error` only blocks on errors.

## CI snippet

```yaml
- name: Run Semgrep
  uses: semgrep/semgrep-action@v1
  continue-on-error: true
  with:
    config: "p/ci"
    generateSarif: "true"
- uses: ./.github/actions/rulebound
  with:
    base: main
    format: github
    allow-commands: "false"
```

`continue-on-error: true` lets Rulebound be the authoritative gate instead of failing the workflow twice. The Semgrep action writes its SARIF to `semgrep.sarif` at the repo root by default — point `report:` at whatever path your action emits.

If you prefer Rulebound to run Semgrep, set `allow-commands: "true"` and drop the dedicated Semgrep step.

## Troubleshooting

`rulebound doctor`:

```
  ✓ analyzer:semgrep       semgrep: 1 report(s) ready
```

Tool missing:

```
  ! analyzer:semgrep       semgrep: required tool not found on PATH (semgrep)
```

Install Semgrep (`pip install semgrep`) and re-run.

Report missing:

```
ERROR  semgrep-ci  Analyzer report not found: reports/semgrep.sarif. Run the analyzer first or pass --allow-commands so rulebound can run `semgrep --config p/ci --sarif --output reports/semgrep.sarif .` itself.
```

Fix: run Semgrep once locally, or pass `--allow-commands` so Rulebound runs the configured `run:` command itself.
