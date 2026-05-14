# Scenario evidence (design)

## Status

**DESIGN ONLY — not implemented in v0.1.**

No code path in Rulebound v0.1 depends on scenario evidence. The engine does
not parse a `type: scenario` check, the CLI has no scenario flag, and no
example or production rule should rely on a scenario report. This document
captures the planned shape so that when implementation begins it lands inside
a clear product boundary instead of expanding into a sandbox/twin project.

Until that work starts and ships with tests, treat every section below as a
proposal. Do not cite it as a capability.

## Product boundary

Rulebound is the policy and evidence layer for scenario testing. It consumes
deterministic reports produced by other tools. It does not run scenarios.

When scenario support ships, Rulebound will:

- require a scenario report at a known path,
- parse the deterministic scenario status (`passed` / `failed` / `error`),
- verify required assertions are present and `passed`,
- include trace artifacts (logs, recordings, request/response captures) in
  the evidence block of the check result,
- block when the scenario report is missing, stale, errored, or failed.

Rulebound will **not**:

- build API twins, MCP twins, or service sandboxes itself,
- replay HTTP traffic or boot service doubles,
- judge a scenario via LLM "looks correct" reasoning — only the report's
  deterministic status decides pass/fail,
- backfill a missing report by re-running anything itself.

External scenario runners (Playwright, Cypress, Pact, service-specific
harnesses, API twins, MCP twins, custom test rigs) own execution. Rulebound
owns the gate.

## Report schema (proposed)

The proposed scenario report is a single JSON file written by the external
runner. Rulebound reads it; the runner owns its format on disk only insofar
as it conforms to this schema.

| Field         | Type     | Required | Notes                                                                 |
|---------------|----------|----------|-----------------------------------------------------------------------|
| `schema`      | string   | yes      | Schema version, e.g. `"rulebound.scenario/v1"`.                       |
| `scenario`    | string   | yes      | Stable scenario identifier. Matches the rule's `scenario` field.      |
| `status`      | enum     | yes      | `"passed"` \| `"failed"` \| `"error"`.                                |
| `environment` | object   | yes      | Where the scenario ran (runner, target, commit, timestamp).           |
| `assertions`  | object[] | yes      | Individual assertion results. Empty array allowed only when `status` is `"error"`. |
| `trace`       | object[] | no       | Pointers to trace artifacts (log files, HAR captures, recordings).    |

### Example

```json
{
  "schema": "rulebound.scenario/v1",
  "scenario": "cli.pack-install",
  "status": "passed",
  "environment": {
    "runner": "playwright@1.49.0",
    "target": "rulebound-cli@0.1.0",
    "commit": "abc1234",
    "startedAt": "2026-05-14T08:12:03Z",
    "finishedAt": "2026-05-14T08:12:41Z"
  },
  "assertions": [
    {
      "id": "exit-code-zero",
      "status": "passed",
      "actual": 0,
      "expected": 0
    },
    {
      "id": "pack-installed-on-disk",
      "status": "passed",
      "evidence": "node_modules/@rulebound/pack-typescript/package.json"
    }
  ],
  "trace": [
    { "kind": "log", "path": "reports/scenarios/cli-pack-install.log" },
    { "kind": "har", "path": "reports/scenarios/cli-pack-install.har" }
  ]
}
```

A planned `type: scenario` check would reference this file:

```yaml
# PROPOSED — not implemented in v0.1.
checks:
  - type: scenario
    id: cli-pack-install
    scenario: cli.pack-install
    report: reports/scenarios/cli-pack-install.json
    require_status: passed
    require_assertions: [exit-code-zero, pack-installed-on-disk]
    max_age_minutes: 60
    severity: error
```

Stale reports (older than `max_age_minutes` relative to the commit or current
run) must fail closed. A missing or unparseable report is `ERROR`, not
`NOT_APPLICABLE`.

## First Rulebound-owned scenarios (planned)

When scenario support lands, Rulebound dogfoods it on four scenarios first.
Each has a deterministic pass/fail oracle that does not require LLM judgment.

1. **CLI pack install scenario** — `rulebound init` against a fresh fixture
   project must produce the expected rule files on disk and exit `0`.
2. **MCP deterministic check scenario** — driving `validateDeterministic` via
   the MCP server tool surface must return the same report shape as the CLI
   for an identical input.
3. **PR markdown generation scenario** — `rulebound check --format github`
   on a known failing fixture must produce the documented markdown structure
   (headings, table of failures, exit code).
4. **Analyzer fixture scenario** — a fixture project with a pinned PMD or
   ESLint config and known-bad source must yield the expected normalized
   findings via `type: analyzer`.

These four cover the v0.1 surface (CLI, MCP, CI output, analyzer
orchestration) without requiring any external sandbox.

## Out of scope for v0.1

The following are explicitly **not** part of v0.1 and must not appear in
rules, examples, or release-gate checklists:

- a working `type: scenario` check in the engine,
- a CLI flag to run or generate scenarios,
- a built-in scenario runner, API twin, or MCP twin,
- HTTP recording / replay infrastructure,
- LLM-based scenario adjudication,
- a UI for browsing scenario reports,
- packaging scenario reports inside the existing repair JSON contract.

If a v0.1 task starts to depend on any of the above, it is out of scope —
re-plan it without scenario evidence.

## Open questions

- Should `schema` be a URL (resolvable) or an opaque version string only?
- How does Rulebound discover trace artifacts when the runner emits them
  outside the repo (e.g. CI-only storage)? Likely: trace entries carry a
  URI plus an optional local path.
- Do we need a per-assertion `severity`, or is the report-level `status`
  enough? Leaning toward report-level only to avoid recreating the rule
  schema inside the report.
- Where does `max_age_minutes` measure from on PR runs — the report's
  `finishedAt`, the commit timestamp, or the CI job start? Probably the
  report's `finishedAt`, but this needs a written rule before shipping.
- How are scenario reports waived? Likely through the existing waiver
  mechanism keyed on `ruleId` + `checkId`, but waiver scope for a failed
  external run deserves an explicit policy.
