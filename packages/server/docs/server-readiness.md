# Server Readiness

Status of `@rulebound/server` for production deployment. Be honest about what's
hardened and what is deferred. The product wedge is CLI + MCP + CI; the server
is a secondary surface and should not be marketed as production-grade until the
items in "Not hardened" are resolved.

## Hardened

- **Versioned Drizzle migrations**. `packages/server/migrations/0000_initial.sql`
  captures the schema in `src/db/schema.ts`. A fresh Postgres database can be
  bootstrapped with `pnpm --filter @rulebound/server db:migrate` (sets
  `DATABASE_URL`, applies all migrations in order via
  `drizzle-orm/postgres-js/migrator`). `pnpm --filter @rulebound/server db:check`
  runs the offline structural drift check; `scripts/check-migration-drift.sh`
  wraps it for CI and additionally probes the working tree to catch
  uncommitted schema changes. Future schema edits must land with a generated
  migration file (`pnpm --filter @rulebound/server db:generate`).
- **Env validation at boot**: `validateServerEnv()` (see `src/startup-checks.ts`)
  fails fast with a clear aggregated error when `DATABASE_URL` or
  `RULEBOUND_ENCRYPTION_KEY` are missing or malformed. Called inside the
  direct-run `if` block in `src/index.ts` **before** `serve()` is invoked, so
  the HTTP listener never binds when the environment is invalid.
- **Encryption at rest for secrets**: webhook secrets and any field passed
  through `lib/crypto.ts` use AES-256-GCM with a 32-byte key supplied via
  `RULEBOUND_ENCRYPTION_KEY`.
- **API auth**: bearer tokens are hashed (SHA-256) before lookup; missing,
  malformed, or expired tokens are rejected at the middleware layer.
- **Structured logging redaction**: `@rulebound/shared/logger` redacts
  `Authorization`, `auth`, `Cookie`, `Set-Cookie`, `X-API-Key`, and any field
  whose name ends in `token`, `key`, `secret`, `password`, or `passphrase`
  (case-insensitive). Callers do not need to opt in.
- **Dashboard session cookies are hardened** (in `apps/web`, not in this
  package): the `/api/dashboard-auth/session` route sets `httpOnly: true`,
  `sameSite: "lax"`, and `secure: process.env.NODE_ENV === "production"`. The
  server package itself does not issue cookies; cookie-based session handling
  lives in the Next.js app.

## Verified by tests

| Claim | Test file | Test name |
| --- | --- | --- |
| `validateServerEnv` rejects missing `DATABASE_URL` | `src/__tests__/startup-checks.test.ts` | `throws when DATABASE_URL is missing` |
| `validateServerEnv` rejects malformed `RULEBOUND_ENCRYPTION_KEY` | `src/__tests__/startup-checks.test.ts` | `throws when RULEBOUND_ENCRYPTION_KEY is malformed` |
| Logger redacts `Authorization`, `Cookie`, `api_key`, `*_token`, `password` | `src/__tests__/logger-redaction.test.ts` | `redacts Authorization, Cookie, and api_key fields in info logs` |
| Logger redacts sensitive fields on the stderr stream too | `src/__tests__/logger-redaction.test.ts` | `redacts sensitive fields in error logs (stderr stream)` |
| Logger redacts nested sensitive fields, preserves safe siblings | `src/__tests__/logger-redaction.test.ts` | `redacts nested objects without dropping safe siblings` |
| AES-256-GCM round-trip and tampering detection | `src/__tests__/crypto.test.ts` | (all tests) |
| Webhook signature verification | `src/__tests__/webhooks.test.ts` | (all tests) |

## Not hardened (deferred — do not treat as production-ready)

- **API scope enforcement**: scope check middleware is wired (Wave 2) but
  `RULEBOUND_LEGACY_TOKEN_SCOPES=1` is still honoured during the v0.2
  deprecation window so that tokens with an empty `scopes` array continue to
  authenticate. The bypass is logged at boot
  (`warnLegacyTokenScopesEnv()` in `src/startup-checks.ts`) and on every
  request that lands on a guarded route. **Removal milestone:** v0.3.0 turns
  the env into a no-op; v0.4.0 drops the legacy `"read"`/`"validate"` string
  mapping. Operators must rotate tokens before the v0.3.0 upgrade. See
  `docs/scope-taxonomy.md` for the migration checklist.
- **Rate limiting**: not implemented in-process. Deploy behind a reverse proxy
  (nginx, Cloudflare, API gateway) that enforces request rate limits per token
  and per IP.
- **Integration tests against real Postgres**: current tests exercise units
  with mocks. There is no ephemeral-Postgres integration suite.
- **CORS**: currently set to `cors()` defaults (allow all). Lock down origins
  before exposing to a browser-trusted dashboard.
- **CSRF**: the server is intended for token-authenticated CLI/CI use; cookie
  sessions are a dashboard concern. If you reuse this server with a cookie
  session, add CSRF protection at the route handler.
- **Audit log retention / PII**: audit metadata is stored as `jsonb`. Reviewers
  should treat the column as sensitive and apply retention policies at the
  deployment layer.

## Required before "prod-ready" label

1. Implement scope enforcement in `authMiddleware` (validate scopes per route).
   See `packages/server/docs/scope-taxonomy.md` for the agreed scope set and the
   legacy-token compatibility plan.
2. Lock down CORS origins.
3. Document rate-limiting expectations in the deployment runbook or implement
   it in-process.
4. Add a real ephemeral-Postgres integration test.
5. Run a secret scan and a dependency-vulnerability scan against the deployed
   container before release.
