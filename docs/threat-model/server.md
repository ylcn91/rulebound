# Threat Model — Server (`@rulebound/server`)

## Surface description

`@rulebound/server` is a Hono HTTP API (`packages/server/src/index.ts`)
that exposes the Rulebound audit/rules/projects/webhook surface to the
self-hosted dashboard and to native SDK clients. Routes:

- `/v1/validate` — accept advisory validation results from CLI/agent
  callers.
- `/v1/rules`, `/v1/projects`, `/v1/audit`, `/v1/compliance`,
  `/v1/sync`, `/v1/analytics` — CRUD over the audit data model.
- `/v1/tokens` — issue/list/delete API tokens
  (`packages/server/src/api/tokens.ts`).
- `/v1/webhooks` — manage outbound webhook endpoints and receive
  inbound GitHub events.

Persistence: PostgreSQL via Drizzle ORM (`packages/server/src/db/`).

Surface maturity: **preview** per
[`docs/amp-91-new.md`](../amp-91-new.md) §3. Not a SaaS, not multi-tenant
beyond `orgId` separation, not RBAC-complete. Operators are expected to
deploy one server per trust boundary.

## Trust boundary

**Inside:** the Postgres database, the encryption key
(`RULEBOUND_ENCRYPTION_KEY`, validated at boot in
`packages/server/src/startup-checks.ts:5-15`), the API tokens table,
and any data persisted via the audit log. The server process itself.

**Outside:** all HTTP clients. Authentication is bearer token; the only
unauthenticated paths are `/health` (`packages/server/src/index.ts:23`)
and `/v1/webhooks/in` (inbound GitHub webhook receiver — verified by
HMAC signature, not by bearer token).

A token holder is **inside** the boundary up to the scope of their
token. An attacker who obtains a token impersonates that org.

## Assets behind the boundary

| Asset | Where | Why it matters |
| --- | --- | --- |
| API tokens (hashed) | `apiTokens` table; `tokenHash = sha256(token)` (`packages/server/src/api/tokens.ts:13`, `middleware/auth.ts:7-9`) | Hash-only storage — server cannot recover the plaintext. Leaked tokens grant full org access until rotated. |
| Webhook secrets (encrypted) | `webhookEndpoints.encryptedSecret` (`packages/server/src/api/webhooks.ts:50`, `lib/crypto.ts`) | AES-encrypted with `RULEBOUND_ENCRYPTION_KEY`. Loss of the key bricks decryption; theft of the key + DB dump compromises every webhook signature. |
| Audit log | `auditLog` table | Compliance evidence; may contain rule IDs, project names, user IDs, and (per AMP91-SRV-007) metadata that operators might let drift toward PII. |
| Org isolation | `requireRequestIdentity`/`requireMatchingOrg` (`packages/server/src/lib/request-context.ts`) | Every route filters by `identity.orgId`; a missing `orgId` filter is a tenant-isolation break. |
| GitHub webhook events | `/v1/webhooks/in` | Spoofed events would write garbage into the audit log and trigger downstream notifications. |

## Threats

| ID | STRIDE | Description | Mitigation | Residual | Linked task |
| --- | --- | --- | --- | --- | --- |
| SRV-T1 | Spoofing | Bearer token authentication compares a SHA-256 hash of the incoming token against `apiTokens.tokenHash` (`packages/server/src/middleware/auth.ts:7-39`). The comparison uses Drizzle's `eq()`, which generates a SQL `WHERE tokenHash = $1` — constant-time at the DB layer, but the **prefix index** (token starts with `rb_…`) is a function of secret entropy, not a side channel. A leaked token grants full access up to its scopes. | Tokens are 32-byte random hex prefixed `rb_` (`packages/server/src/api/tokens.ts:11-16`); 64 bits of entropy minimum. SHA-256 hash stored only — server cannot recover plaintext. `lastUsedAt` is updated on every authenticated call (`middleware/auth.ts:45-48`), giving operators a forensic signal. Tokens carry `scopes` (default `["read","validate"]`) and `expiresAt`. | **High** if a token leaks (CI secret store breach, accidental commit to source). Rotation procedure documented in `docs/runbooks/secret-rotation.md`. | AMP91-SRV-002 (scope enforcement Wave 2 verdict B4). |
| SRV-T2 | Elevation | `scopes` are stored on the token (`apiTokens.scopes`) and exposed to handlers via `c.set("tokenScopes", …)` (`middleware/auth.ts:52`) but **no route currently enforces them**. Per Team B Wave 2 (SRV-002), the 11-scope taxonomy (`rules:read/write`, `projects:read/write`, `audit:read/write`, `tokens:write`, `webhooks:write`, `validate:run`, `compliance:read`, `sync:write`) will be enforced via middleware. Until that lands, any valid token can hit any route. | None at the route level today. Operators are advised to issue narrow tokens per use case until SRV-002 ships. | **High** until SRV-002 merges. | AMP91-SRV-002. |
| SRV-T3 | Information disclosure | Webhook delivery (`packages/server/src/webhooks/dispatcher.ts:30-78`) calls `fetch(url, …)` with operator-supplied `url`. There is **no SSRF guard** in v0.1: an attacker who can write a webhook endpoint can target `http://169.254.169.254/` (cloud metadata), `http://localhost:6379/` (Redis), or any internal service reachable from the server's network. | `fetch` follows redirects by default in Node 22 — `redirect: "manual"` is **not** set in `dispatcher.ts:40-51`. DNS rebinding has no defense. The HMAC signature header (`X-Rulebound-Signature`) is computed against the body but does not constrain `url`. Timeout is 10 s (`signal: AbortSignal.timeout(10000)`). | **High** in any deployment where the server has reachability to internal services or to a cloud metadata endpoint. The Wave 2 task SRV-006 adds private-IP/loopback/link-local/metadata IP denial with `RULEBOUND_WEBHOOK_ALLOW_PRIVATE_TARGETS=1` opt-out and `redirect: "manual"` enforcement. | AMP91-SRV-006 (Team B Wave 2). |
| SRV-T4 | Information disclosure | CORS is configured globally as `app.use("*", cors())` (`packages/server/src/index.ts:20`) — the default Hono CORS is `Access-Control-Allow-Origin: *`. A browser at any origin can read JSON responses if it has a valid token (which a malicious page typically does not, but a misconfigured browser extension or stored XSS in a customer dashboard could). | None at the server today. Wave 2 (SRV-003) introduces `RULEBOUND_ALLOWED_ORIGINS` with prod default empty (deny all browsers unless explicit env). Dev default `http://localhost:3000`. | **High** for any production deployment where a token could end up in a browser context. | AMP91-SRV-003 (lead-decisions B1). |
| SRV-T5 | DoS | No rate limiting in v0.1. `/v1/tokens` POST creates tokens (entropy-bounded), `/v1/audit` POST writes rows, `/v1/webhooks/endpoints` POST writes encrypted secrets. A token holder can flood the DB. Authentication middleware itself runs a SHA-256 + a DB `SELECT` + `UPDATE` per request — cheap, but unbounded. | None at the server. Wave 2 (SRV-004) introduces in-process opt-in limiter via `RULEBOUND_RATE_LIMIT_PER_MIN_TOKEN` / `_IP` env vars (default off, no-op when unset). Runbook requires a reverse proxy when env unset. | **Medium**. Operators currently must rely on reverse-proxy rate limiting (nginx/caddy). | AMP91-SRV-004 (lead-decisions B2). |
| SRV-T6 | Information disclosure | The audit log accepts arbitrary `metadata` JSON from CLI/SDK callers (`packages/server/src/api/audit.ts`). A poorly written client can ship full source snippets, error messages with credentials, or user PII into the table. Once stored, that data ends up in dashboard renderings, exports, and webhook payloads (`violation.detected` event). | The audit schema in `packages/server/src/schemas.ts` validates `metadata` as `z.record(z.any())` — no shape check. Server-side shared logger redaction (`packages/server/src/__tests__/logger-redaction.test.ts`) covers logs, not persisted rows. | **Medium**. Documented as AMP91-SRV-007 (audit retention + PII policy). | AMP91-SRV-007. |
| SRV-T7 | Tampering | Inbound webhook receiver `/v1/webhooks/in` (`packages/server/src/webhooks/receivers.ts`) verifies GitHub HMAC signatures. If the secret is misconfigured (empty string, default value), signature verification can be bypassed. | `verifyGitHubSignature` requires both the signature header and the configured secret; missing secret returns false. The route is the only unauthenticated `/v1/*` path (`packages/server/src/index.ts:25-32`). | **Low**. Operator checklist below. | n/a. |
| SRV-T8 | Repudiation | `apiTokens.lastUsedAt` is updated on every authenticated call but **per-request audit is not written** — only call sites that explicitly insert into `auditLog` are tracked. An attacker who exfiltrates data via repeated `GET /v1/audit?limit=10000` requests leaves only the `lastUsedAt` trace. | Operators can run a reverse proxy with access logs. The token table records `lastUsedAt`. | **Medium**. AMP91-SRV-007 retention policy is per-row, not per-call. | AMP91-SRV-007 follow-up: optional per-call audit middleware. |
| SRV-T9 | Information disclosure | Error responses include a `details` field with `parsed.error.issues` from Zod (`packages/server/src/api/projects.ts:40, 108`; `api/tokens.ts:45`). Zod issue paths are field names — generally safe — but include the input shape. | Acceptable for a self-hosted preview; no PII leakage from Zod issue paths themselves. | **Low**. | n/a. |
| SRV-T10 | Spoofing | The startup check `validateServerEnv` (`packages/server/src/startup-checks.ts:32-51`) requires `DATABASE_URL` and a 64-hex `RULEBOUND_ENCRYPTION_KEY`. There is no check that the key has not been used to encrypt against a different DB — key reuse across environments can succeed silently. | Operator practice. Key rotation procedure in `docs/runbooks/secret-rotation.md` mandates a fresh key per env. | **Medium** (operator error category). | AMP91-SRV-001 (migrations) is the more pressing schema-level item. |

## Operator checklist

- Generate `RULEBOUND_ENCRYPTION_KEY` per environment: `openssl rand
  -hex 32`. Never reuse across dev/staging/prod.
- Deploy behind a reverse proxy (nginx, caddy, fly-proxy) with rate
  limiting and TLS termination until SRV-004 lands. Treat the server's
  bind port as internal-only.
- Issue tokens with `scopes` and `expiresAt` set, even before SRV-002
  enforces scopes. Rotate every 90 days.
- Set `RULEBOUND_ALLOWED_ORIGINS=` (empty) in production until SRV-003
  introduces the explicit allowlist. The dashboard talks to the server
  through a server-side proxy (`apps/web/lib/server-proxy.ts`), so
  browser-direct calls are not required.
- Run the server with network egress restricted to the providers and
  destinations that webhooks legitimately target. Block private IPs
  (RFC 1918, link-local, metadata) at the egress firewall as defense
  in depth for SRV-T3 until SRV-006 ships.
- Configure inbound webhook secrets only via env or admin-only API
  calls; do not allow self-service inbound endpoint creation.
- Sanitize CLI/SDK `metadata` payloads in clients (do not pass entire
  diffs or full snippets to `/v1/audit`); SRV-T6 mitigations are
  primarily client-side until SRV-007 ships.

## Open questions

- Should `tokens` POST require an additional confirmation header (e.g.
  `X-Confirm-Sensitive: 1`) to slow down compromised-token chains?
  Deferred; depends on SRV-002 scope split (`tokens:write` will be a
  separate scope).
- Should the inbound webhook receiver's HMAC compare be constant-time?
  Current implementation uses Node's `timingSafeEqual` in `receivers.ts`
  (verify before sign-off). If not, file follow-up.
- Audit log retention default: today there is no TTL. SRV-007 sets a
  policy. What is the default — 90 days, 365 days, indefinite?
  Recommendation: 365 days indefinite for self-hosted v0.1, with an
  operator-controlled `RULEBOUND_AUDIT_RETENTION_DAYS` env var in
  SRV-007.

## Reviewer sign-off

- Date:
- Reviewer:
- Notes:
