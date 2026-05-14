# @rulebound/server

## Status

Preview. See the Maturity tiers table in the root [README](../../README.md#maturity-tiers).

This package ships an HTTP API (Hono) and a Drizzle schema for centralized rule management, projects, tokens, audit and webhook delivery. It is intentionally not part of the quick-start path; the canonical product surface is `@rulebound/cli` + `@rulebound/mcp` + CI.

## What is shipped today

- A schema (`src/db/schema.ts`) describing organizations, projects, rules, compliance snapshots, webhooks, and audit logs.
- A Hono-based API surface (`src/index.ts`).
- Auth/token primitives.

## What is missing (and why this is Preview)

- **No migration tooling.** There is no `migrations/` directory yet, and no `db:migrate`, `db:generate`, or `db:studio` scripts. The schema is the source of truth; you must apply it yourself (e.g. `drizzle-kit push` from your own workflow) or pin Postgres schema management to your deployment process.
- **Tenancy / role matrix is not finalized.** The schema models organizations, projects, and tokens, but the role/scope authorization matrix is still being shaped. Treat any role enforcement as work-in-progress.
- **No backwards-compatibility guarantees.** Schema and route shape can change without warning until this package graduates to Beta.

See `docs/dashboard-readiness.md` for the broader readiness checklist that tracks how this package and `apps/web` reach Beta.

## Running locally

This package will only start with explicit environment configuration. Required env vars are documented in `src/config.ts`. PostgreSQL 17 is required.

## Roadmap to Beta

1. Migration lifecycle: `migrations/` directory, `db:migrate` / `db:generate` / `db:studio` scripts, CI drift check.
2. Auth/scope matrix freeze: owner/admin/member/viewer roles + API token scopes.
3. Row-level authorization helpers + tests.
4. Audit event taxonomy.
