# Audit retention and PII redaction

Status: preview (SRV-007). The Rulebound server records every authenticated
mutation in the `audit_log` table. This document explains the two operator
controls that exist today and what they do not do.

## What is in `audit_log`

`audit_log` is append-only at the application layer (no UPDATE / DELETE
endpoint). Each row carries:

- `id` (uuid)
- `orgId`, `projectId`, `userId` — identity scope for the entry
- `action` — short identifier such as `rule.created`, `validation.violation`
- `ruleId` — set when the action references a specific rule
- `status` — server-defined outcome (`success`, `VIOLATED`, ...)
- `metadata` — `jsonb`; **operator-controlled**, may contain anything the
  calling surface chose to attach
- `createdAt`

The `metadata` column is the surface area for accidental PII / secret
disclosure. Treat any value you write into it as if it were exported to a CSV
file an operator hands to compliance review tomorrow.

## Retention sweep

The server provides a `pruneAuditEntries(db, options?)` helper:

```ts
import { pruneAuditEntries, getDb } from "@rulebound/server"

const db = getDb()
const result = await pruneAuditEntries(db, { retentionDays: 90 })
// result.deleted: rows removed
// result.cutoff: ISO timestamp; rows older than this were deleted
// result.skipped: true if retention is disabled (0)
```

`pruneAuditEntries` does not schedule itself. Operators wire it into:

- a cron job (`node` script invoked by the platform scheduler), or
- a worker thread that wakes once an hour, or
- an admin CLI command driven by support.

### Retention window

The retention window is read from `RULEBOUND_AUDIT_RETENTION_DAYS`:

| Value          | Behaviour                                       |
|----------------|-------------------------------------------------|
| unset / blank  | 90 days (default)                               |
| positive int   | that many days                                  |
| `0`            | retain forever; a warn log is emitted on each call |
| anything else  | falls back to 90, warn log emitted              |

The cutoff is `now - retentionDays * 24h`. Rows with `createdAt < cutoff` are
deleted.

The sweeper has **no lock**. Running multiple sweepers concurrently is safe
(they observe the same cutoff and the second observes "0 deleted"), but you
will see redundant deletion attempts in the logs. Do not enable the sweeper
on every replica; pick one.

## PII redaction on read

`listAuditEntries` (used by `GET /v1/audit`) and `renderAuditCsv` (used by
`GET /v1/audit/export`) both run their results through `redactAuditMetadata`
before returning. The default denylist is:

```
token  secret  password  email  ip
```

Matching is case-insensitive and substring-based: keys like `userEmail`,
`clientSecretV2`, `apiToken`, `IP_ADDRESS` all match. When a key matches,
the value is replaced wholesale with the literal string `[REDACTED]` — we do
not partial-mask. This is intentional: leakage that is partially masked is
hard to spot in CSV exports.

### What redaction does NOT do

- It does not scrub values written to `metadata`. The data on disk is
  unchanged. A direct SQL query against `audit_log.metadata` still returns
  the original value.
- It does not promise compliance with any specific framework (GDPR /
  HIPAA / SOC2). Use it as defence-in-depth, not as your only control.
- It does not redact the `action`, `status`, or other top-level columns —
  surfaces that put PII into those columns are bugs to fix.

If you need stronger guarantees, encrypt the `metadata` column at rest with
a customer-managed key. That work is not in this scope.

## How to widen the denylist

Both functions accept an explicit `keys` array as their last argument:

```ts
const csv = renderAuditCsv(entries, [
  ...DEFAULT_REDACTED_KEYS,
  "phone",
  "ssn",
])
```

We do not currently expose a runtime env to add keys to the default list —
operators who need that should fork the array at their integration point. If
you have a use case for an env-driven extension, file an issue.

## Migration notes

There is no schema change associated with retention. The sweep operates on
the existing `audit_log_created_at_idx` index for efficiency. If you have
billions of rows you may want to add a separate retention column to enable
partial-index pruning; this is not implemented in v0.1.
