# Runbook — Server (`@rulebound/server`)

## Scope

`@rulebound/server` is a **preview** Hono HTTP API that backs the
self-hosted dashboard and any native SDK clients. This runbook walks an
operator through standing up a single-org deployment with Postgres.

What is **not** in v0.1: hosted SaaS, multi-org RBAC UI, organization
invitations, full audit retention TTL enforcement, in-process rate
limiting (planned in AMP91-SRV-004).

## Pre-deploy checklist

| Item | Required | Source |
| --- | --- | --- |
| Node.js 22.x | Yes | Build target. |
| PostgreSQL 14+ | Yes | Recommended PG 17 to match `packages/server/drizzle.config.ts`. |
| `DATABASE_URL` | Yes | Postgres URI; checked at boot (`packages/server/src/startup-checks.ts:6-8`). |
| `RULEBOUND_ENCRYPTION_KEY` | Yes | 64-hex (32 bytes), generated via `openssl rand -hex 32`. Validated at boot (`startup-checks.ts:9-15`). |
| Reverse proxy with TLS | Yes | Server speaks plain HTTP; TLS termination is the proxy's job. |
| Egress firewall policy | Yes | Block private IPs / metadata endpoints to mitigate SRV-T3 (webhook SSRF) until AMP91-SRV-006 ships. |
| Migrations applied | Yes | See "Migration apply" below. |
| Inbound port not publicly exposed | Yes | The bind port should be internal-only; clients reach the API via the reverse proxy. |

## Deploy steps

### 1. Provision Postgres

Recommended sizing for self-hosted preview: 2 vCPU, 4 GB RAM, 50 GB
disk. Audit log dominates row count over time.

```sql
CREATE DATABASE rulebound;
CREATE USER rulebound_app WITH ENCRYPTED PASSWORD '<set-in-secret-store>';
GRANT CONNECT ON DATABASE rulebound TO rulebound_app;
```

Set `DATABASE_URL=postgres://rulebound_app:…@host:5432/rulebound`.

### 2. Generate the encryption key

```sh
openssl rand -hex 32 > /run/secrets/rulebound_encryption_key
```

Persist via your secret manager. Loss of this key bricks decryption of
encrypted webhook secrets. Rotation: see
[`secret-rotation.md`](./secret-rotation.md).

### 3. Apply migrations

Until a packaged migration CLI ships (AMP91-SRV-001, Team B Wave 1), use
the workspace tooling:

```sh
git clone https://github.com/rulebound/rulebound.git
cd rulebound
pnpm install --frozen-lockfile
pnpm --filter @rulebound/server run db:migrate
```

The migration runner reads `packages/server/migrations/*.sql` and
applies them via Drizzle. Migration drift checker (per AMP91-SRV-001
acceptance) refuses to start the server when schema disagrees with the
migration set.

### 4. Build the server

```sh
pnpm --filter @rulebound/server build
```

Output: `packages/server/dist/index.js` (ESM). Container image and
helm chart are **out of scope for v0.1** — package as a tarball or run
the dist directly under your process supervisor (systemd, nomad,
fly-init). A minimal example systemd unit:

```ini
[Service]
ExecStart=/usr/bin/node /opt/rulebound/dist/index.js
EnvironmentFile=/etc/rulebound/server.env
Restart=on-failure
User=rulebound
```

### 5. Issue the first scope token

Once the server is up, issue an initial admin token via direct DB
insert (the API itself is bearer-token-protected; bootstrap requires
DB-level seeding until AMP91-SRV-002 ships a `tokens:bootstrap` flow):

```sql
INSERT INTO api_tokens
  (org_id, user_id, name, token_hash, token_prefix, scopes, created_at)
VALUES
  ('<org-uuid>', '<user-uuid>', 'bootstrap',
   encode(sha256('rb_<hex>'::bytea), 'hex'),
   substring('rb_<hex>' from 1 for 10),
   ARRAY['read','validate']::text[],
   now());
```

Generate the token offline (`openssl rand -hex 32`), prepend `rb_`,
store the plaintext in your secret store, store the hash in the DB.

After AMP91-SRV-002 lands (Team B Wave 2), the scope set will expand to
the 11-scope taxonomy per lead-decision B4
([`.claude/lead-decisions.md`](../../.claude/lead-decisions.md) §1.B
B4). Until then, every authenticated token can hit every route.

### 6. Configure CORS

In v0.1, `app.use("*", cors())` sets `Access-Control-Allow-Origin: *`
(`packages/server/src/index.ts:20`). For production, run the API behind
a reverse proxy that strips CORS headers from inbound paths the
dashboard does not need, **or** wait for AMP91-SRV-003 (lead-decision
B1) which adds `RULEBOUND_ALLOWED_ORIGINS` with prod default empty.

Until SRV-003 ships, the dashboard talks to the API through a
server-side proxy (`apps/web/lib/server-proxy.ts`), so browser-direct
CORS is not required for the day-one flow.

### 7. Rate-limit posture

There is **no in-process rate limit** in v0.1. Required mitigations:

- Nginx / caddy / fly-proxy with `limit_req_zone` at 10 req/s per IP
  for `/v1/*` paths.
- Block `/v1/webhooks/in` from any IP that is not GitHub's published
  hook range (or the inbound webhook provider you use).

After AMP91-SRV-004 lands (lead-decision B2), opt in via
`RULEBOUND_RATE_LIMIT_PER_MIN_TOKEN` and `RULEBOUND_RATE_LIMIT_PER_MIN_IP`.
Until then, the runbook requires the reverse proxy.

## Post-deploy verification

```sh
curl https://<your-host>/health
# {"status":"ok","version":"0.1.0"}

curl -H "Authorization: Bearer $RULEBOUND_API_TOKEN" \
  https://<your-host>/v1/rules
# {"data":[...]}
```

Verify that:

1. `/v1/*` rejects unauthenticated requests with 401.
2. `/health` is reachable without auth and returns 200.
3. The server log line at startup includes the bind port and does
   **not** print `DATABASE_URL` or `RULEBOUND_ENCRYPTION_KEY` (the
   shared logger redacts on key match — see
   `packages/server/src/__tests__/logger-redaction.test.ts`).
4. `psql` shows your `api_tokens` row.
5. From a private network only — public exposure should be the reverse
   proxy, not the server's own port.

## Rollback procedure

The server is stateful (Postgres-backed). Rollback steps:

1. **Stop the new version** of the server process (`systemctl stop
   rulebound-server` or equivalent).
2. **Identify the migration set** at the previous release. Migration
   filenames are versioned (`0000_initial.sql`, etc.).
3. **Reverse the migrations** added by the new release. There is **no
   automatic down-migration** in v0.1 — Drizzle migrations are
   forward-only. For preview deployments, the safe pattern is:
   - Take a Postgres backup before the upgrade
     (`pg_dump --format=custom`).
   - On rollback, restore from the backup (`pg_restore`).
4. **Re-deploy the previous server version**.
5. **Re-verify** `/health` and a known `/v1/rules` query.

If schema changes are additive only (new columns, new tables), the old
server version will tolerate the new schema. If a column was renamed
or dropped, the old server fails to start. Take the backup.

Token continuity: tokens issued under the new version remain valid
after rollback (the hash format is stable). Webhook endpoints
encrypted under the new version remain decryptable as long as
`RULEBOUND_ENCRYPTION_KEY` does not change.

## Operational notes

- The server's structured logger redacts known sensitive keys
  (`packages/shared/src/logger.ts`). Audit metadata is **not**
  automatically redacted — clients should sanitize before POSTing to
  `/v1/audit` (per SRV-T6 in the threat model).
- Webhook outbound delivery (`packages/server/src/webhooks/dispatcher.ts`)
  follows redirects by default and does not block private IPs in v0.1.
  Block private-IP egress at the firewall layer until AMP91-SRV-006
  ships.
- Postgres backups: at minimum daily `pg_dump`, retained for 30 days,
  with a tested restore procedure. The audit log grows ~1 KB per
  validation row.

## Cross-references

- [`docs/threat-model/server.md`](../threat-model/server.md) — SRV-T1
  through SRV-T10.
- [`docs/runbooks/secret-rotation.md`](./secret-rotation.md) — token,
  encryption key, webhook secret rotation.
- [`docs/runbooks/incident-response.md`](./incident-response.md) —
  triage steps for server incidents.
- [`docs/runbooks/dashboard-deploy.md`](./dashboard-deploy.md) — the
  dashboard's relationship to the server.
