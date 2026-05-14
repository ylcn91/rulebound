---
title: DB schema change requires a migration
category: workflow
severity: error
modality: must
tags: [db, drizzle, deterministic, diff-evidence]
stack: [typescript, drizzle, postgres]
---

# DB schema change requires a migration

If any file under `packages/server/src/db/schema*.ts` (or a similarly-named
schema source) changes, the same diff must contain at least one new or
modified SQL migration. Without this evidence rule, a schema rename can ship
with no upgrade path for production databases.

```rulebound
checks:
  - type: diff-evidence
    id: schema-needs-migration
    when_changed:
      - "packages/server/src/db/schema.ts"
      - "packages/server/src/db/schema/**/*.ts"
    require_changed:
      - "packages/server/migrations/**/*.sql"
      - "packages/server/drizzle/**/*.sql"
    severity: error
    message: "Schema change detected without a migration file."
```
