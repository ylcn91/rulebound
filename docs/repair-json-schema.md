# Repair JSON Schema

`rulebound check --format repair-json` produces a single JSON document on stdout
designed for agent self-repair loops. This document is **the contract**; CLI
changes that alter field names, types, or shape land here together with a
schema bump.

The companion snapshot test —
`packages/cli/src/__tests__/repair-json.snapshot.test.ts` — pins this shape so
unintentional drift breaks CI.

## Contract goals

1. Stable enough for an agent's `if` / `for` / `switch` over its fields.
2. Self-describing: every failure carries enough context to fix it.
3. `rerun` is the *exact* command the agent should retry after applying its
   smallest fix.
4. Sensitive content (passwords, tokens, keys) in `evidence.snippet` is
   redacted before emission via `redactSnippet` — see
   `packages/cli/src/lib/redact-snippet.ts`.

## Top-level shape

```ts
interface RepairJsonReport {
  status: "PASSED" | "FAILED" | "PASSED_WITH_WARNINGS"
  summary: {
    total: number
    pass: number
    violated: number
    notApplicable: number
    error: number
    blocking: number
    waived: number
  }
  failures: RepairItem[]
  waived: WaivedItem[]
  expiredWaivers: ExpiredWaiverItem[]
  next: string
}
```

- `status` mirrors the deterministic engine status: `FAILED` exits the CLI
  with code 1; anything else exits 0 (or 3 with `--fail-on-advisory`, but
  the JSON payload itself is unchanged).
- `summary` is the engine summary verbatim.
- `failures` contains every blocking and non-blocking violation/error that
  is **not** waived.
- `waived` lists violations that were suppressed by a matching waiver.
- `expiredWaivers` lists waivers whose `expires` is in the past; the
  underlying rule remains blocking.
- `next` is the canonical fix-loop hint.

## RepairItem

```ts
interface RepairItem {
  ruleId: string          // dotted rule id, e.g. "starter.no-debugger"
  checkId: string         // stable check identifier
  source: "ast" | "regex" | "diff" | "file" | "import-boundary"
        | "command" | "analyzer" | "agent-process"
        | "keyword" | "semantic" | "llm"
  file?: string           // present iff evidence.filePath is set
  line?: number           // present iff evidence.line is set
  evidence?: CheckEvidence
  reason: string          // short human description (~1 sentence)
  suggestedFix?: string   // optional one-line fix hint
  rerun: string           // exact shell command to retry — stable per --allow-commands
}
```

### `rerun` stability rule

`rerun` is **the** field agents anchor on. It MUST be stable for a given
invocation:

- without `--allow-commands` → `"rulebound check --format repair-json"`
- with `--allow-commands` → `"rulebound check --allow-commands --format repair-json"`

If new flags (e.g. `--base`, `--rule`) are added that affect what's checked,
they must be threaded into the rerun command as well; the snapshot test will
flag silent regressions.

### `evidence` shape (subset)

```ts
interface CheckEvidence {
  filePath?: string
  line?: number
  column?: number
  snippet?: string        // redacted before emission
  diffPaths?: string[]
  command?: string
  exitCode?: number
  stdout?: string         // truncated to ≤16KB
  stderr?: string         // truncated to ≤16KB
  analyzerReport?: string
  matches?: string[]      // analyzer findings list, capped at 20
}
```

## WaivedItem

```ts
interface WaivedItem {
  ruleId: string
  checkId: string
  file?: string
  line?: number
  waiverReason: string    // mirrors the waiver's reason field
  expires?: string        // ISO 8601 date string
}
```

Waived items do **not** appear in `failures`. They live in `waived` so
agents can mention them without acting on them.

## ExpiredWaiverItem

```ts
interface ExpiredWaiverItem {
  rule: string
  expires: string
  reason: string
}
```

Expired waivers cause the underlying violation to **re-block**: that
violation appears in `failures` *and* its waiver appears here. Agents
must treat expired waivers as bugs to fix, not as soft warnings.

## `next` field

Two stable values:

- `"GREEN — no repair needed"` — when `failures.length === 0`.
- `"Apply smallest fix per failure, rerun the same check."` — otherwise.

## Example

```json
{
  "status": "FAILED",
  "summary": {
    "total": 1,
    "pass": 0,
    "violated": 1,
    "notApplicable": 0,
    "error": 0,
    "blocking": 1,
    "waived": 0
  },
  "failures": [
    {
      "ruleId": "starter.has-readme",
      "checkId": "file-exists:README.md",
      "source": "file",
      "file": "README.md",
      "evidence": {
        "filePath": "README.md"
      },
      "reason": "Expected file not found: README.md",
      "rerun": "rulebound check --format repair-json"
    }
  ],
  "waived": [],
  "expiredWaivers": [],
  "next": "Apply smallest fix per failure, rerun the same check."
}
```

## Versioning policy

This document and the snapshot test are part of the v0.1 stable surface.
Breaking changes (renaming `failures` → `errors`, removing `rerun`, etc.)
require:

1. A schema-version field bump (currently implicit via `SCHEMA_VERSION`
   in `packages/engine/src/report-schema.ts` — see
   `docs/report-schema.md` for the master versioning policy).
2. A migration note in `docs/release-gate.md`.
3. Both this doc and the snapshot test updated in the same commit.

Non-breaking additions (new optional fields) require only the doc + snapshot
update.
