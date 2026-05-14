# DeterministicReport Schema

## Overview

`DeterministicReport` is the canonical contract returned by
`validateDeterministic()` in `@rulebound/engine`. Every CLI output format
(`pretty`, `json`, `github`, `sarif`, `repair-json`, `pr-markdown`), the MCP
deterministic tools, and downstream consumers (dashboards, history snapshots,
CI summaries) read from this shape. The types live in
`packages/engine/src/checks/` and are re-exported through
`packages/engine/src/report-schema.ts`, which is the single import path
external code should use. The runtime guard `validateDeterministicReport`
exists to defensively parse JSON snapshots loaded from disk or the wire.

## Schema version

```ts
import { SCHEMA_VERSION } from "@rulebound/engine"
// SCHEMA_VERSION === "1.0.0"
```

Stamping policy:

- `SCHEMA_VERSION` is **doc-only** in v1.0. It is exported as a constant so
  callers that persist reports can stamp them (e.g. `{ schemaVersion: "1.0.0",
  ...report }`), but `validateDeterministic()` does **not** emit it.
- `printJson` / `printSarif` / `printRepairJson` output bytes are unchanged.
- Existing consumers that key on the current fields continue to work without
  modification.

## Top-level shape

```ts
interface DeterministicReport {
  status: "PASSED" | "FAILED" | "PASSED_WITH_WARNINGS"
  summary: Summary
  results: CheckResult[]
  ruleStatuses: RuleStatus[]
  parseErrors: ReportParseError[]
  waiversApplied: AppliedWaiver[]
}
```

| Field            | Type                                              | Required | Description                                                                                |
| ---------------- | ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `status`         | `"PASSED" \| "FAILED" \| "PASSED_WITH_WARNINGS"`  | yes      | Overall verdict. `FAILED` iff at least one blocking violation. `PASSED_WITH_WARNINGS` if there are non-blocking violations or errors. |
| `summary`        | `Summary`                                         | yes      | Counters aggregated across `results`. See below.                                           |
| `results`        | `CheckResult[]`                                   | yes      | One entry per check execution (a single rule may produce multiple).                        |
| `ruleStatuses`   | `RuleStatus[]`                                    | yes      | One entry per rule input, including advisory-only rules with zero checks.                  |
| `parseErrors`    | `ReportParseError[]`                              | yes      | Schema errors encountered while parsing a rule's `checks:` block. Empty if no errors.      |
| `waiversApplied` | `AppliedWaiver[]`                                 | yes      | Every waiver that matched a violation, including expired ones (flagged via `expired`).     |

### Summary

| Field           | Type     | Description                                                          |
| --------------- | -------- | -------------------------------------------------------------------- |
| `total`         | `number` | `results.length`.                                                    |
| `pass`          | `number` | Count of `results[*].status === "PASS"`.                             |
| `violated`      | `number` | Count of `VIOLATED`.                                                 |
| `notApplicable` | `number` | Count of `NOT_APPLICABLE`.                                           |
| `error`         | `number` | Count of `ERROR` (analyzer/runner failures, not rule violations).    |
| `blocking`      | `number` | Count of `results[*].blocking === true` after waiver application.    |
| `waived`        | `number` | Count of non-expired applied waivers.                                |

## Nested types

### `RuleStatus`

Per-rule aggregated verdict.

| Field        | Type                                                                  | Description                                                                  |
| ------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ruleId`     | `string`                                                              | Rule identifier from the rule YAML / Markdown front-matter.                  |
| `title`      | `string`                                                              | Rule title.                                                                  |
| `checkCount` | `number`                                                              | Number of `checks:` declared on the rule.                                    |
| `status`     | `"PASS" \| "VIOLATED" \| "NOT_APPLICABLE" \| "ERROR" \| "ADVISORY"`   | Aggregated status (see [Status enum asymmetry](#status-enum-asymmetry)).     |
| `blocking`   | `boolean`                                                             | True if any `CheckResult` for the rule was blocking after waiver application.|

### `CheckResult`

Per-check execution record.

| Field           | Type                                                       | Required | Description                                                                       |
| --------------- | ---------------------------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `ruleId`        | `string`                                                   | yes      | Owning rule.                                                                       |
| `checkId`       | `string`                                                   | yes      | Stable identifier for the check (explicit `id:` or runner-derived).                |
| `status`        | `"PASS" \| "VIOLATED" \| "NOT_APPLICABLE" \| "ERROR"`      | yes      | Outcome of this check. Cannot be `ADVISORY`.                                       |
| `source`        | `DeterministicSource`                                      | yes      | Which runner produced the result (`regex`, `ast`, `analyzer`, ...).                |
| `deterministic` | `boolean`                                                  | yes      | True for runners that produce reproducible verdicts.                               |
| `confidence`    | `"exact" \| "high" \| "medium" \| "low" \| "advisory"`     | yes      | Confidence band attached to the verdict.                                           |
| `blocking`      | `boolean`                                                  | yes      | Whether this result blocks (per the rule's severity + enforcement mode + waivers). |
| `reason`        | `string`                                                   | yes      | Human-readable explanation.                                                        |
| `evidence`      | `CheckEvidence`                                            | no       | Pointer to where the violation lives (file, line, snippet, analyzer output).       |
| `suggestedFix`  | `string`                                                   | no       | Auto-suggested remediation, if the runner can produce one.                         |
| `waived`        | `{ reason: string; expires?: string }`                     | no       | Present if a non-expired waiver matched.                                           |

### `CheckEvidence`

| Field            | Type        | Description                                                              |
| ---------------- | ----------- | ------------------------------------------------------------------------ |
| `filePath`       | `string`    | Repo-relative path. Required for SARIF location emission.                |
| `line`           | `number`    | 1-based line number.                                                     |
| `column`         | `number`    | 1-based column number.                                                   |
| `snippet`        | `string`    | Source excerpt (truncated by some printers).                             |
| `diffPaths`      | `string[]`  | Paths involved in a diff-evidence check.                                 |
| `command`        | `string`    | Command string for `command` / `analyzer` runners.                       |
| `exitCode`       | `number`    | Exit code of the executed command.                                       |
| `stdout`         | `string`    | Captured stdout. **Verbatim — may be large.** See size warning below.    |
| `stderr`         | `string`    | Captured stderr. **Verbatim — may be large.** See size warning below.    |
| `analyzerReport` | `string`    | Path to a parsed analyzer report (e.g. PMD XML, SARIF).                  |
| `matches`        | `string[]`  | Matched substrings (regex / keyword runners).                            |

### `Waiver`

| Field     | Type        | Required | Description                                                  |
| --------- | ----------- | -------- | ------------------------------------------------------------ |
| `rule`    | `string`    | yes      | Rule ID this waiver targets.                                 |
| `reason`  | `string`    | yes      | Why the rule is waived.                                      |
| `owner`   | `string`    | yes      | Accountable owner. Required — waivers are never anonymous.   |
| `expires` | `string`    | yes      | ISO date. Waivers must be time-boxed.                        |
| `check`   | `string`    | no       | Optional `checkId` filter; matches all checks if absent.     |
| `scope`   | `string[]`  | no       | Optional glob paths; matches all files if absent.            |

### `AppliedWaiver`

| Field     | Type          | Description                                                                                          |
| --------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| `result`  | `CheckResult` | The check result the waiver matched.                                                                 |
| `waiver`  | `Waiver`      | The waiver entry.                                                                                    |
| `expired` | `boolean`     | True if the waiver's `expires` is in the past. Expired waivers do **not** suppress the violation.    |

### `ReportParseError`

| Field    | Type       | Description                                                              |
| -------- | ---------- | ------------------------------------------------------------------------ |
| `ruleId` | `string`   | Rule whose `checks:` failed to parse.                                    |
| `errors` | `string[]` | One or more parser messages.                                             |

## Status enum asymmetry

`RuleStatus.status` may be `"ADVISORY"`. `CheckResult.status` cannot.

Why: deterministic checks are only produced by rules that declare a `checks:`
block. A rule with zero checks (advisory-only — typically a keyword or LLM
matcher) produces zero `CheckResult` entries but still appears in
`ruleStatuses` so consumers can render "this rule was considered but did not
run deterministically." Therefore `"ADVISORY"` is a rule-level aggregate, not
an individual check outcome.

## Field size warnings

`evidence.stdout` and `evidence.stderr` are emitted **verbatim** by analyzer
and command runners. For verbose analyzers (PMD on a large monorepo, Semgrep
with many rules, etc.) these strings can be hundreds of kilobytes to several
megabytes. The engine does not truncate them at write time. Consumers that
persist or transport reports (e.g. database columns, message queues, HTTP
response bodies) should clamp / paginate / stream as appropriate. Some
formatters (e.g. SARIF `snippet`) apply their own per-field truncation; the
underlying `DeterministicReport` does not.

## Format coverage matrix

Which top-level / nested field each CLI `--format` reads. A checkmark means
the formatter actually emits the field's content; blank means the format
intentionally drops or aggregates the field away.

| Field                                 | pretty | json | github | sarif | repair-json | pr-markdown |
| ------------------------------------- | :----: | :--: | :----: | :---: | :---------: | :---------: |
| `status`                              |   x    |  x   |   x    |       |             |      x      |
| `summary.*`                           |   x    |  x   |   x    |       |             |      x      |
| `results[*].ruleId`                   |   x    |  x   |   x    |   x   |      x      |      x      |
| `results[*].checkId`                  |        |  x   |   x    |   x   |      x      |      x      |
| `results[*].status`                   |   x    |  x   |   x    |   x   |      x      |      x      |
| `results[*].source`                   |   x    |  x   |        |   x   |      x      |      x      |
| `results[*].deterministic`            |        |  x   |        |   x   |             |             |
| `results[*].confidence`               |        |  x   |        |   x   |             |             |
| `results[*].blocking`                 |   x    |  x   |   x    |   x   |             |      x      |
| `results[*].reason`                   |   x    |  x   |   x    |   x   |      x      |      x      |
| `results[*].evidence.filePath`        |   x    |  x   |   x    |   x   |      x      |      x      |
| `results[*].evidence.line`            |   x    |  x   |   x    |   x   |      x      |      x      |
| `results[*].evidence.column`          |        |  x   |   x    |   x   |             |             |
| `results[*].evidence.snippet`         |   x    |  x   |        |   x   |      x      |             |
| `results[*].evidence.stdout`/`stderr` |        |  x   |        |       |      x      |             |
| `results[*].suggestedFix`             |   x    |  x   |        |   x   |      x      |             |
| `results[*].waived`                   |   x    |  x   |   x    |   x   |      x      |      x      |
| `ruleStatuses[*]`                     |        |  x   |        |       |             |      x      |
| `parseErrors[*]`                      |   x    |  x   |        |       |             |      x      |
| `waiversApplied[*]` (non-expired)     |   x    |  x   |        |   x   |             |      x      |
| `waiversApplied[*].expired`           |   x    |  x   |   x    |       |      x      |      x      |

## Compatibility policy

This schema is versioned via `SCHEMA_VERSION` (semver).

- **No field REMOVAL** in patch or minor releases. Removing a documented
  required field is a major-version break.
- **Adding optional fields is ALLOWED in minor.** Consumers must tolerate
  unknown fields.
- **Enum value additions are minor.** Adding a new `DeterministicSource` or a
  new `confidence` band is non-breaking.
- **Enum value removals are major.** Dropping `"NOT_APPLICABLE"` or
  `"ADVISORY"` would break consumers.
- **Unknown keys are ignored** by the runtime guard
  (`validateDeterministicReport`) for forward compatibility. Producers stamped
  with a newer minor `SCHEMA_VERSION` parse cleanly under an older consumer.

## Example JSON

```json
{
  "status": "FAILED",
  "summary": {
    "total": 3,
    "pass": 1,
    "violated": 1,
    "notApplicable": 0,
    "error": 0,
    "blocking": 1,
    "waived": 1
  },
  "results": [
    {
      "ruleId": "no-console-log",
      "checkId": "regex:console.log",
      "status": "PASS",
      "source": "regex",
      "deterministic": true,
      "confidence": "exact",
      "blocking": false,
      "reason": "No matches for forbidden pattern"
    },
    {
      "ruleId": "no-hardcoded-secrets",
      "checkId": "regex:aws-key",
      "status": "VIOLATED",
      "source": "regex",
      "deterministic": true,
      "confidence": "high",
      "blocking": true,
      "reason": "Possible AWS access key in source",
      "evidence": {
        "filePath": "src/config.ts",
        "line": 12,
        "snippet": "const KEY = \"AKIA...\""
      }
    },
    {
      "ruleId": "java-naming",
      "checkId": "analyzer:pmd",
      "status": "VIOLATED",
      "source": "analyzer",
      "deterministic": true,
      "confidence": "high",
      "blocking": false,
      "reason": "PMD: ShortVariable in Foo.java",
      "evidence": {
        "filePath": "src/main/java/Foo.java",
        "line": 7
      },
      "waived": {
        "reason": "Legacy module, scheduled for refactor",
        "expires": "2026-12-31"
      }
    }
  ],
  "ruleStatuses": [
    { "ruleId": "no-console-log",       "title": "No console.log",        "checkCount": 1, "status": "PASS",     "blocking": false },
    { "ruleId": "no-hardcoded-secrets", "title": "No hardcoded secrets",  "checkCount": 1, "status": "VIOLATED", "blocking": true  },
    { "ruleId": "java-naming",          "title": "Java naming",           "checkCount": 1, "status": "VIOLATED", "blocking": false },
    { "ruleId": "prefer-async-await",   "title": "Prefer async/await",    "checkCount": 0, "status": "ADVISORY", "blocking": false }
  ],
  "parseErrors": [
    {
      "ruleId": "broken-rule",
      "errors": ["checks[0].pattern: required string is missing"]
    }
  ],
  "waiversApplied": [
    {
      "result": {
        "ruleId": "java-naming",
        "checkId": "analyzer:pmd",
        "status": "VIOLATED",
        "source": "analyzer",
        "deterministic": true,
        "confidence": "high",
        "blocking": false,
        "reason": "PMD: ShortVariable in Foo.java",
        "evidence": { "filePath": "src/main/java/Foo.java", "line": 7 }
      },
      "waiver": {
        "rule": "java-naming",
        "reason": "Legacy module, scheduled for refactor",
        "owner": "platform-team",
        "expires": "2026-12-31"
      },
      "expired": false
    }
  ]
}
```
