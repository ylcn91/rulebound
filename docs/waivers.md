# Waivers

A waiver is an explicit, time-boxed downgrade of a deterministic violation
from blocking to advisory. Waivers never hide a finding; the report still
lists every waiver that was applied and shows whether it has expired.

## When to use a waiver

- A legitimate finding cannot be fixed in the current change set.
- The finding is acceptable in a narrow scope (e.g., docs-only paths).
- You need a deadline that re-blocks the rule once compliance is feasible.

A waiver is not a way to silence a noisy rule. If a rule is wrong, either
fix the rule or remove it. If a finding is wrong, prove it with a rule
configuration change.

## Schema

The default file is `.rulebound/waivers.yaml`. Override with
`rulebound check --waivers path/to/waivers.yaml`.

```yaml
waivers:
  - rule: deterministic.bugfix-needs-regression-test
    reason: "Docs-only fix; no behavior change."
    owner: "@alice"
    expires: "2026-06-01"
    path:
      - "docs/**"

  - rule: deterministic.no-debugger
    check: no-debugger
    reason: "Vendor file imported as-is for a one-off migration."
    owner: "@bob"
    expires: "2026-05-30"
    path: "scripts/migrations/legacy-import.ts"
```

### Fields

- `rule` (required): the rule ID to waive.
- `reason` (required): one-line justification. Required for audit.
- `owner` (required): GitHub handle or team accountable for clearing the
  waiver before it expires.
- `expires` (required): ISO date string. After this date the waiver is
  inert. Unparseable values are treated as expired.
- `check` (optional): waive only one specific check inside that rule.
- `path` (optional): single glob or array of globs. The waiver only
  applies when the finding's evidence file matches one of the globs.
  Without `path` the waiver applies to every file-pinned finding on the
  rule.
- `scope` (optional, alias for `path`): same semantics. Use `path` going
  forward.

Missing or invalid required fields cause the waiver to be rejected with a
clear error. `rulebound check` exits with code `2` in every format. In
`json`, `sarif`, and `repair-json` the errors are emitted on stderr as
`{"kind": "waiver-load-errors", "errors": [...]}` before the non-zero exit;
in `pretty` they are printed as a red error block.

## Behavior

- A matching, non-expired waiver flips a finding's `blocking` flag to
  `false` and attaches a `waived: { reason, expires? }` marker. The finding
  remains a VIOLATION in the report; the report status becomes
  `PASSED_WITH_WARNINGS` instead of `FAILED`.
- An expired waiver is recorded in `waiversApplied` with `expired: true` but
  does not change the finding. The rule blocks again.
- The summary exposes `summary.waived` for dashboards and CI gates.

### Fail-closed rules

The waiver loader is strict by design — a misconfigured waiver must not
silently let violations through.

- An `expires` value that does not parse as a date is treated as **already
  expired**. The waiver is inert. CI continues to block.
- A waiver with a `scope` glob only applies to findings that include a file
  path in their evidence. Findings without file evidence (for example a
  whole-repo regex requirement) are **not** waived by a scoped waiver.
- Parse errors in `.rulebound/waivers.yaml` are reported and the CLI exits
  with code `2` in every format to prevent ambiguous CI runs. In machine
  formats (`json`, `sarif`, `repair-json`) the errors are emitted to stderr
  as `{"kind": "waiver-load-errors", "errors": [...]}` before the non-zero
  exit so tooling can still parse them.

### How each format surfaces waivers

- `pretty`: violations split into a "blocking" section and a "waived
  (advisory)" section. Expired waivers list separately.
- `github`: waived violations annotate as `::notice` (not `::error` /
  `::warning`). Expired waivers emit a `::warning` so the PR author sees
  the deadline missed.
- `sarif`: waived findings include a `suppressions[]` entry with `kind:
  "external"`, `status: "accepted"`, and the waiver `reason` in
  `justification`. Their `level` is `note`.
- `repair-json`: waived findings move to a separate `waived[]` array;
  `failures[]` only contains items an agent should actually fix. Expired
  waivers surface in `expiredWaivers[]`.

## Verifying waivers in CI

```bash
rulebound check --format json | jq '.waiversApplied[] | select(.expired == true)'
```

Pipe expired waivers into an alert. Treat the expiry as a real deadline.
