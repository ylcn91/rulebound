# Runbook — Secret Rotation

## Scope

Rotation procedures for every secret Rulebound v0.1 holds or accepts.
Audience: the platform operator + the on-call engineer responding to a
suspected leak.

Rotation is part of normal operations (scheduled cadence) *and* part of
incident response (after-leak). The procedure is the same in both
cases; the urgency differs.

## Secret inventory

| Secret | Where stored | Who uses it | Rotation cadence |
| --- | --- | --- | --- |
| `RULEBOUND_ENCRYPTION_KEY` | Server env, `RULEBOUND_ENCRYPTION_KEY` (64-hex) | `@rulebound/server` to encrypt/decrypt webhook secrets (`packages/server/src/lib/crypto.ts`) | Annual or on suspected leak. **High-impact** — see below. |
| API token (server bearer) | Postgres `api_tokens.token_hash`; plaintext kept by clients | CLI clients, dashboard server-side proxy, native SDKs | 90 days, or immediately on leak. |
| Webhook secret (outbound) | Postgres `webhook_endpoints.encrypted_secret` (encrypted at rest) | Server signs deliveries (`packages/server/src/webhooks/dispatcher.ts:23-25`) | When endpoint owner rotates, or on suspected leak. |
| Inbound webhook secret (GitHub) | Server env / Postgres (per-endpoint) | `verifyGitHubSignature` in `packages/server/src/webhooks/receivers.ts` | When GitHub side rotates, or on suspected leak. |
| `RULEBOUND_DASHBOARD_PASSCODE` | Dashboard env | `apps/web/lib/dashboard-auth.ts` | Quarterly, or immediately on leak. |
| `RULEBOUND_API_TOKEN` (dashboard) | Dashboard env, used by server-side proxy | `apps/web/lib/api.ts` to call `@rulebound/server` | Tied to the underlying api_token's rotation. |
| `RULEBOUND_API_KEY` (gateway) | Gateway env | `packages/gateway/src/rule-cache.ts` to fetch rules / emit telemetry | Tied to the underlying api_token's rotation. |
| Provider keys (OpenAI, Anthropic, Google) | Client env, forwarded by gateway | LLM clients | Out of scope — owned by the provider's own rotation procedure. |
| `NPM_TOKEN` for SDK publish | CI secret | Release workflow | On CI compromise, or when the maintainer rotates. |

The encryption key sits at the top — losing it bricks every encrypted
webhook secret. **Rotate it last and most carefully.**

Threat references: [`docs/threat-model/server.md`](../threat-model/server.md)
SRV-T1, SRV-T2, SRV-T10.

## Rotation procedures

### 1. API token rotation (routine, 90-day cadence)

Issue a new token, distribute, then revoke the old one.

```sh
# Step 1 — issue
curl -X POST https://<server>/v1/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"<client-name>-2026Q2","scopes":["read","validate"]}'
# response: {"data":{"token":"rb_<new-hex>",…}}
```

```sh
# Step 2 — distribute via your secret manager
# (Vault / AWS Secrets Manager / 1Password)
```

```sh
# Step 3 — verify the consumer is using the new token
# (deploy / cycle the client, check lastUsedAt on new token)
```

```sh
# Step 4 — revoke the old token
curl -X DELETE https://<server>/v1/tokens/<old-token-id> \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Cross-link: [`server-deploy.md`](./server-deploy.md) §5 for the
bootstrap token issuance path.

### 2. API token rotation (emergency, on leak)

Token is suspected leaked. Revoke first, then issue a replacement.

```sh
# Step 1 — identify the token row
SELECT id, name, token_prefix, last_used_at
FROM api_tokens
WHERE token_prefix = 'rb_xxxxxxxx';

# Step 2 — revoke immediately
DELETE FROM api_tokens WHERE id = '<uuid>';

# Step 3 — audit usage during the leak window
SELECT *
FROM audit_log
WHERE created_at BETWEEN '<leak-start>' AND now()
  AND user_id = '<token-user>'
ORDER BY created_at DESC;

# Step 4 — issue replacement (see routine procedure)

# Step 5 — notify the legitimate consumer of the new value
```

If the leak window is unknown, treat the last `lastUsedAt` as the
upper bound and assume the leak started 90 days prior (or whenever the
token was issued, whichever is more recent).

Cross-link: [`incident-response.md`](./incident-response.md) §2,
[`threat-model/server.md`](../threat-model/server.md) SRV-T1.

### 3. Dashboard passcode rotation

```sh
# Step 1 — generate
openssl rand -base64 32

# Step 2 — update the secret store
# (RULEBOUND_DASHBOARD_PASSCODE in your env management)

# Step 3 — redeploy the dashboard
# Existing session cookies become invalid; all users must
# re-authenticate.

# Step 4 — distribute the new passcode via secret-sharing channel
# (1Password vault item, Vault entry, encrypted Slack DM if no
# infra)
```

The dashboard does not maintain a passcode history — once you rotate,
the old value is gone. Plan the rotation during low-traffic hours if
forced re-auth is disruptive.

Threat ref: lead-decisions §1.B B7; `dashboard-deploy.md` trust
boundary.

### 4. Webhook secret rotation (outbound)

Webhook secrets sign outbound `X-Rulebound-Signature` headers via
HMAC-SHA256 (`packages/server/src/webhooks/dispatcher.ts:23-25`).

```sh
# Step 1 — recreate the endpoint with the new secret
curl -X POST https://<server>/v1/webhooks/endpoints \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://consumer.example.com/hook",
       "secret":"<new-32-byte-hex>",
       "events":["violation.detected"]}'

# Step 2 — share the new secret with the consumer via secret manager

# Step 3 — wait for the consumer to deploy the new secret

# Step 4 — delete the old endpoint
curl -X DELETE https://<server>/v1/webhooks/endpoints/<old-id> \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

There is no overlap window built into the dispatcher — both endpoints
deliver in parallel during the rotation. The consumer must accept
either signature during the rotation window, then switch to
strict-old-secret-rejected after the old endpoint is deleted.

### 5. Inbound webhook secret rotation (GitHub)

Rotate on the GitHub side first, then on the server side.

```sh
# Step 1 — rotate the secret in GitHub repo settings -> Webhooks
# (GitHub will start sending with the new secret)

# Step 2 — update the Rulebound server's stored value
# (DB column or env var, depending on your setup)

# Step 3 — verify by triggering a test event in GitHub
# /v1/webhooks/in returns 200 and the event lands in audit_log
```

If the new secret is misconfigured, `verifyGitHubSignature` returns
false and `/v1/webhooks/in` returns 401. GitHub's "Redelivery" button
is the recovery path; no event is lost as long as you fix the secret
within GitHub's redelivery window.

### 6. `RULEBOUND_ENCRYPTION_KEY` rotation (high-impact)

This is the only rotation that requires re-encrypting stored data.
Plan a maintenance window.

```sh
# Step 1 — generate the new key offline
openssl rand -hex 32 > /tmp/rb-new-key.hex

# Step 2 — write a one-off re-encryption script
# (decrypt with old key, encrypt with new key, update row)
# Pseudocode:
#   for row in webhook_endpoints:
#     plaintext = decrypt(row.encrypted_secret, OLD_KEY)
#     row.encrypted_secret = encrypt(plaintext, NEW_KEY)
#     save(row)

# Step 3 — STOP the server.

# Step 4 — run the re-encryption script against the prod DB
# (after testing against a staging copy).

# Step 5 — update RULEBOUND_ENCRYPTION_KEY in the secret store.

# Step 6 — START the server with the new key.

# Step 7 — verify webhook deliveries work end-to-end.

# Step 8 — wipe /tmp/rb-new-key.hex
```

**Do not** rotate the encryption key without a re-encryption pass —
the server will start, but every webhook delivery will fail when it
tries to decrypt the now-mismatched secret.

If the encryption key is **lost** (no copy in the secret store), every
encrypted webhook secret is permanently unrecoverable. Each webhook
endpoint must be re-created from scratch with new secrets distributed
to consumers.

Cross-link: [`threat-model/server.md`](../threat-model/server.md)
SRV-T10.

### 7. `NPM_TOKEN` rotation (publish credentials)

Used by the release workflow to publish `@rulebound/*` packages.

```sh
# Step 1 — revoke the old token in npm dashboard
# https://www.npmjs.com/settings/<org>/tokens

# Step 2 — create a new automation token

# Step 3 — update CI secret (GITHUB ACTIONS secret NPM_TOKEN)

# Step 4 — trigger a dry-run release to verify
```

The npm registry's audit log shows publish events keyed by token; if
a leak is suspected, query the registry for unexpected publishes
before rotating.

## Rotation tracking

Maintain a spreadsheet / Vault entry / Notion doc with:

| Secret | Last rotated | Owner | Next rotation due |
| --- | --- | --- | --- |
| `RULEBOUND_ENCRYPTION_KEY` (prod) | 2026-01-15 | platform-ops | 2027-01-15 |
| Admin API token | 2026-03-01 | platform-ops | 2026-06-01 |
| Dashboard passcode | 2026-02-10 | platform-ops | 2026-05-10 |
| … | … | … | … |

Schedule rotation calendar reminders. Missed rotations are
operational debt and a finding for any compliance audit.

## Cross-references

- [`docs/threat-model/server.md`](../threat-model/server.md) — secret
  threats grounded in code.
- [`docs/runbooks/incident-response.md`](./incident-response.md) —
  leak-triggered rotation runs the same procedure with higher
  urgency.
- [`docs/runbooks/server-deploy.md`](./server-deploy.md) — initial
  secret issuance during deployment.
- [`docs/runbooks/dashboard-deploy.md`](./dashboard-deploy.md) —
  passcode setup.
- [`docs/runbooks/gateway-deploy.md`](./gateway-deploy.md) —
  `RULEBOUND_API_KEY` usage.
