# Runbook — Incident Response

## Scope

This runbook covers production incidents affecting any Rulebound
surface. It is intentionally surface-agnostic at the top and
surface-specific in the per-incident steps.

Audience: the on-call platform engineer who got paged.

## Alert sources

The reference deployment in v0.1 has **no built-in alerting**.
Operators wire their own monitoring against:

| Signal | Source | Suggested threshold |
| --- | --- | --- |
| Server `/health` | reverse proxy uptime check | 3 consecutive failures in 60 s. |
| Server 5xx rate | reverse proxy access log | >1% over 5 minutes. |
| Gateway `/health` | reverse proxy uptime check | Same as server. |
| Gateway prompt-body leak | log aggregator search for `DEBUG_FULL_BODIES` | Any hit. |
| Postgres connection saturation | Postgres `pg_stat_activity` | >80% of `max_connections`. |
| Dashboard 5xx rate | reverse proxy access log | >5% over 5 minutes. |
| Disk usage on Postgres host | host metrics | >85%. |
| Audit log row count growth | DB query | >2× weekly baseline. |
| Webhook delivery failures | server logs (`DeliveryResult.success: false`) | >10% over 15 minutes. |

Contact points: **TBD** — operators populate their own paging tier,
escalation rotation, and Slack/Teams channel. Recommend:

- **Primary on-call:** `<set in your PagerDuty/Opsgenie>`.
- **Secondary on-call:** `<set in your PagerDuty/Opsgenie>`.
- **Engineering escalation:** `<your team's manager>`.
- **Security escalation:** `<your security lead>` for prompt leak,
  token leak, or webhook SSRF events.

## Triage flowchart

```
                  alert fires
                       │
                       ▼
            ╭────────────────────╮
            │ identify surface   │
            │ (CLI / server /    │
            │  dashboard /       │
            │  gateway)          │
            ╰─────────┬──────────╯
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
  data risk?     availability   compliance
                    impact?       impact?
        │             │             │
        ▼             ▼             ▼
  see "Data       see "Avail.    see "Compliance
  exposure"       degraded"      drift"
  below           below          below
```

## Per-incident playbooks

### 1. Data exposure — prompt body leaked from gateway

Symptoms: log aggregator search for `userPrompt`, `responseBody`,
`systemPromptPreview` returns hits in production. Or someone
discovered `DEBUG_FULL_BODIES=1` in the gateway's running config.

Steps:

1. **Stop the gateway** at the affected instances. Drain traffic at
   the load balancer; clients will get connection errors. This is
   acceptable — prompt leakage continues every second the flag is on.
2. **Identify the time window** the flag was active. Cross-reference
   process start time with the gateway's startup log (look for the
   warn line from AMP91-GW-002 if shipped).
3. **Purge logs** in the affected time window from the log aggregator
   (Datadog, Loki, Splunk). Trigger your log-retention exception
   policy.
4. **Identify exposed prompts.** If the logs reached an external SaaS,
   file a deletion request per your data-processing agreement.
5. **Notify** affected teams. The owning teams of the LLM clients
   whose prompts were captured must know.
6. **Re-deploy** the gateway without `DEBUG_FULL_BODIES`. Confirm the
   startup warn line is absent.
7. **Post-mortem:** how did the flag get set? Update config
   management.

Threat ref: [`docs/threat-model/gateway.md`](../threat-model/gateway.md)
GW-T1.

### 2. Data exposure — API token leaked

Symptoms: a token surfaces in a public source tree, an attacker uses
it via `lastUsedAt` anomaly, or a developer reports accidental commit.

Steps:

1. **Revoke** the token via direct DB:
   ```sql
   DELETE FROM api_tokens WHERE token_prefix = 'rb_xxxxxxxx';
   ```
   (Token prefix is the first 10 characters of the plaintext.)
2. **Audit** `api_tokens.last_used_at` and the server's reverse-proxy
   access log for requests authenticated with the revoked token's
   prefix. Identify the data accessed.
3. **Rotate** the token for the legitimate consumer. See
   [`secret-rotation.md`](./secret-rotation.md).
4. **If audit log data was scraped:** assess sensitivity, notify
   teams per your incident-disclosure policy.
5. **Post-mortem:** how did the token get committed/leaked? Update
   `.gitleaks.toml` allowlist if the token shape was missed; AMP91-SEC-001
   (Wave 2) wires gitleaks into the release gate.

Threat ref: [`docs/threat-model/server.md`](../threat-model/server.md)
SRV-T1, SRV-T2.

### 3. Data exposure — webhook SSRF / internal target hit

Symptoms: a webhook endpoint configured by a user points at
`http://169.254.169.254/` (cloud metadata) or `http://localhost:6379/`
(internal Redis). Outbound delivery succeeds and returns sensitive
data in `deliverWebhook`'s logged response.

Steps:

1. **Disable the webhook endpoint** via the API or direct DB:
   ```sql
   UPDATE webhook_endpoints SET events = ARRAY[]::text[]
   WHERE id = '<endpoint-uuid>';
   ```
2. **Check the egress firewall.** Until AMP91-SRV-006 ships, private
   IPs must be denied at the firewall level. Verify the rule is in
   place; this is the single biggest defense.
3. **Audit `webhook_deliveries`** for prior deliveries to the
   suspicious URL. Note any 2xx responses (these returned data the
   attacker could observe).
4. **Rotate** any secrets the attacker may have observed. Cloud
   metadata endpoints expose short-lived credentials; rotate the
   instance's IAM role attachment.
5. **Post-mortem:** prioritize AMP91-SRV-006 (Team B Wave 2). The
   firewall rule is a layered defense, not the primary fix.

Threat ref: SRV-T3.

### 4. Data exposure — dashboard passcode leak

Symptoms: passcode appears in a Slack message, in source control, or
in a screen-share recording.

Steps:

1. **Rotate the passcode immediately.** Generate a new value via
   `openssl rand -base64 32`. Update
   `RULEBOUND_DASHBOARD_PASSCODE` in the secret store. Redeploy the
   dashboard.
2. **Existing sessions are invalidated** because the session cookie
   value is compared to the passcode (`apps/web/lib/dashboard-auth.ts`).
   Users must re-authenticate.
3. **Audit dashboard reverse-proxy logs** for foreign IPs that
   successfully passed through `/api/*` paths during the leak window.
4. **Notify** the team that the passcode was rotated. Distribute the
   new value via your secret-sharing channel (1Password, Vault).

Threat ref: lead-decisions §1.B B7 + `dashboard-deploy.md` trust
boundary statement.

### 5. Availability degraded — server down

Symptoms: `/health` failing, 5xx rate spiking, or Postgres connection
pool exhausted.

Steps:

1. **Check Postgres.** `SELECT count(*) FROM pg_stat_activity;` — if
   near `max_connections`, increase the pool size or kill long-running
   transactions.
2. **Check server process.** `systemctl status rulebound-server` or
   equivalent. Look for `OOMKilled`, `Migration drift`, or `Encryption
   key invalid` boot errors (`packages/server/src/startup-checks.ts`
   error messages).
3. **Check disk** on the Postgres host. Audit log grows ~1 KB/row;
   running out of disk causes Postgres to refuse writes.
4. **If migration drift error:** apply pending migrations
   (`pnpm --filter @rulebound/server run db:migrate`) or roll the server
   back to the previous version (see
   [`rollback.md`](./rollback.md)).
5. **Restore traffic** via the reverse proxy. Confirm
   `/health` returns 200.

### 6. Availability degraded — gateway down or buffering

Symptoms: gateway memory grows, requests time out, or upstream
provider returns errors.

Steps:

1. **Memory growth:** restart the gateway. AMP91-GW-003 has not yet
   capped the stream buffer; long chat sessions can grow it. A process
   memory limit (`--max-old-space-size=2048` or cgroup limit) forces
   a graceful OOM rather than host swap.
2. **Upstream failure:** check `OPENAI_TARGET_URL` / equivalent.
   `curl` directly to verify provider reachability.
3. **Rule cache failure:** if `RULEBOUND_SERVER_URL` is set and the
   server is down, rule fetches fail. The gateway's rule cache TTL
   determines how long stale rules persist; after expiry, rule
   injection silently degrades. Either restore the server or set
   `RULEBOUND_INJECT_RULES=false` temporarily.
4. **Restart and verify** with the post-deploy verification steps in
   [`gateway-deploy.md`](./gateway-deploy.md).

### 7. Compliance drift — audit log contains PII

Symptoms: a query of `audit_log.metadata` returns rows with email
addresses, source code, or credentials.

Steps:

1. **Stop the offending client.** Identify the source (CLI vs
   dashboard vs SDK call) via `audit_log.user_id` and recent commit
   activity. Reach out to the team and pause their CI integration.
2. **Quarantine the rows.** Until a retention policy ships
   (AMP91-SRV-007), the safe move is:
   ```sql
   UPDATE audit_log SET metadata = '{}'::jsonb WHERE id IN (…);
   ```
   Record the row IDs and your reason; treat this as a manual
   redaction event.
3. **Patch the client** to sanitize metadata before POSTing.
4. **Post-mortem:** accelerate AMP91-SRV-007 (audit retention + PII
   policy) if recurrence likelihood is high.

Threat ref: SRV-T6.

## Communication template

When you declare an incident, post the following in your
incident-management channel within 5 minutes of triage:

```
Title: [Rulebound] <surface>: <one-line summary>
Severity: SEV-1 / SEV-2 / SEV-3
Surfaces affected: <CLI | server | dashboard | gateway>
Customer impact: <description>
Started: <UTC time>
Incident commander: <name>
Status: investigating | mitigating | recovered | resolved
Last update: <UTC time>
```

Update every 30 minutes until resolved. Final post-mortem within 5
business days.

## Cross-references

- [`docs/runbooks/rollback.md`](./rollback.md) — version rollback
  steps per surface.
- [`docs/runbooks/secret-rotation.md`](./secret-rotation.md) — token,
  encryption key, passcode rotation.
- [`docs/threat-model/`](../threat-model/) — threat definitions
  referenced in each playbook.
- [`docs/release-gate.md`](../release-gate.md) — release gate stages
  that should have caught the issue (post-mortem input).
