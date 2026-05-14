---
title: DB schema changes require a migration
category: workflow
severity: error
modality: must
tags: [db, drizzle, migrations, evidence]
stack: [typescript]
scope: [packages/server]
---

# DB schema changes require a migration

When `packages/server/src/db/schema.ts` is modified, the same change set must
include at least one migration SQL file under `packages/server/migrations/`.

This is a deterministic guardrail against drift between the ORM schema and the
shipped database state. Drizzle's `drizzle-kit generate` produces the SQL
artefact — committing it alongside the schema edit makes the change
reproducible from `migrations/` alone.

Note: as of today no migrations directory exists in this repo. This rule is a
no-op until the first migration is added. It is shipped now so the policy is
in place the moment migrations land — no rule lag between feature and
enforcement.

```rulebound
checks:
  - type: diff-evidence
    id: db-schema-needs-migration
    severity: error
    when_changed:
      - "packages/server/src/db/schema.ts"
    require_changed:
      - "packages/server/migrations/**/*.sql"
    message: "DB schema changed without a migration SQL file under packages/server/migrations/"
```
