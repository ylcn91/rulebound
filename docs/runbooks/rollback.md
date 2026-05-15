# Runbook — Rollback

## Scope

Per-surface rollback procedures. Use this when a release has shipped
and must be reverted. Each section pairs with the corresponding deploy
runbook.

Rollback in v0.1 is **manual**. There is no orchestrator that
coordinates rollback across surfaces. The operator is responsible for
order-of-operations.

## Pre-rollback checklist

| Item | Required | Why |
| --- | --- | --- |
| Identify the failing surface | Yes | Surfaces roll back independently. |
| Identify the previous known-good version | Yes | Tag, image digest, or commit SHA. |
| Postgres backup taken before the bad release | Yes for server | Migrations are forward-only in v0.1. |
| Incident commander assigned | Yes | See [`incident-response.md`](./incident-response.md). |
| Traffic drain plan | Yes for server / dashboard / gateway | Decide whether to fail-open or fail-closed during rollback. |
| Communication channel open | Yes | Status updates every 15 minutes during rollback. |

## CLI rollback (`@rulebound/cli`)

The CLI is stateless. Rollback is a downgrade.

```sh
npm install -g @rulebound/cli@<previous-version>
rulebound --version  # verify
```

If the new version was wired into CI via the composite action, also
revert the action pin:

```yaml
# .github/workflows/<your-workflow>.yml
- uses: rulebound/rulebound/.github/actions/rulebound@v0.1.0  # ← old version
```

Compatibility:

- The CLI's `--format json` schema is stable per AMP91-ENG-001. A
  downgraded CLI reads the same rules a newer CLI wrote.
- If the **rules directory** contains check types or schema fields the
  older CLI does not understand, the older CLI returns `ERROR`
  results (exit code 2) rather than silently passing. Roll the rules
  directory back in lock-step (`git revert` the rules commit).

## Server rollback (`@rulebound/server`)

The server is stateful. Rollback steps:

1. **Verify backup exists.**
   ```sh
   pg_restore --list <backup-file> | head
   ```
   If no backup exists from before the bad release, **stop** — assess
   whether a forward fix is safer than a partial rollback.

2. **Drain traffic.** Mark the server unhealthy in the reverse proxy
   so the dashboard and SDK clients fail fast rather than hitting a
   half-rolled-back service.

3. **Stop the current server.**
   ```sh
   systemctl stop rulebound-server
   # or container stop / k8s scale-to-zero
   ```

4. **Restore Postgres** from the pre-release backup.
   ```sh
   pg_restore --clean --if-exists --no-owner \
     -d "$DATABASE_URL" <backup-file>
   ```

   Data loss: every audit row, webhook delivery, token issued, and
   project edit between backup time and rollback is gone. Communicate
   this to affected teams.

   Alternative: if only a single migration was bad and the schema
   change is reversible, write a manual reverse migration instead of
   a full restore. Document the SQL in the post-mortem.

5. **Deploy the previous server build.** Match the version that
   produced the backup's schema. Mismatch causes the server's startup
   check to fail (migration drift in AMP91-SRV-001).

6. **Verify boot.**
   ```sh
   curl https://<server-host>/health
   # {"status":"ok","version":"<previous-version>"}
   ```

7. **Restore traffic** at the reverse proxy.

8. **Re-verify auth.** `curl -H "Authorization: Bearer
   $RULEBOUND_API_TOKEN" https://<server-host>/v1/rules` returns 200.

Tokens: tokens issued before the backup are still valid (hashes are
stable). Tokens issued after the backup but before the rollback are
**gone** — recipients must request new tokens.

## Dashboard rollback (`apps/web`)

The dashboard is stateless. Rollback steps:

1. **Stop the current dashboard.**
2. **Deploy the previous build** (previous `.next/` artifact or
   container image).
3. **Start.**
4. **Verify.** `/access` returns the access page. With a valid
   session cookie, `/api/v1/rules` returns the server's response.

Session cookies remain valid across versions because the cookie value
equals `RULEBOUND_DASHBOARD_PASSCODE` (`apps/web/lib/dashboard-auth.ts`).
Rolling back does not log users out.

If the rollback is triggered by a **passcode leak**, do **not** just
roll back — rotate the passcode (see
[`secret-rotation.md`](./secret-rotation.md)) before re-deploying.

## Gateway rollback (`@rulebound/gateway`)

The gateway is stateless. Rollback steps:

1. **Drain traffic.** Mark the gateway pod / instance unhealthy in
   the load balancer. In-flight streams are terminated; clients
   reconnect.
2. **Stop the current gateway.**
3. **Deploy the previous build.**
4. **Verify.**
   ```sh
   curl https://<gateway-host>/health
   # {"status":"ok","type":"gateway","version":"<previous-version>"}
   ```
5. **Verify passthrough.** A `GET /openai/v1/models` returns the
   OpenAI model list.
6. **Restore traffic.**

If the rollback is triggered by a **prompt-leak incident**
(`DEBUG_FULL_BODIES=1` was on in production), the rollback itself does
not purge the logs. Refer to
[`incident-response.md`](./incident-response.md) §1.

## MCP rollback (`@rulebound/mcp`)

The MCP server is stateless and is launched per-session by the agent
runtime. Rollback = downgrade the installed package and restart the
agent.

```sh
npm install -g @rulebound/mcp@<previous-version>
# Restart the agent runtime to pick up the new binary.
```

Compatibility: MCP shares the engine with the CLI, so the same
rules-directory compatibility constraints apply (see CLI rollback).

## SDK rollback (native + TypeScript)

SDKs are consumed by clients. Rollback steps:

1. **Pin clients to the previous version** in their dependency files.
2. **Re-deploy clients.**
3. **No server-side action required** — the server's API is shared by
   all SDK versions.

If the bad release was an SDK breaking change (typed payload shape
drift), AMP91-SDK-001's contract test should have caught it before
publish. If a client is broken by a recent SDK upgrade, request a
patch release of the SDK before rolling back the server.

## Multi-surface rollback order

When rolling back multiple surfaces simultaneously (e.g. a coordinated
release that touched server + dashboard + SDK), use this order to
minimize broken-state windows:

1. **Dashboard** first (it depends on the server).
2. **Gateway** next (it depends on the server for rule fetches if
   `RULEBOUND_SERVER_URL` is set).
3. **Server** last (it has the most blast radius and the largest
   restore time).
4. **SDK clients** ride server timing — they are pulled forward by
   client deploys, not by Rulebound.

Reverse for forward deploys. Always communicate rollback completion
to affected teams.

## Post-rollback verification

For every surface rolled back:

1. **Health endpoint returns 200.**
2. **A canonical end-to-end test passes.** For server: a known token
   can fetch `/v1/rules`. For dashboard: a known session can reach
   `/api/v1/rules`. For gateway: a passthrough completion succeeds.
3. **Logs show the previous version on startup.**
4. **Reverse proxy access logs** show 2xx for the canonical paths.
5. **Incident channel is updated** with the rollback completion.

## Post-mortem inputs

After a rollback:

- Capture the failing version's release notes.
- Capture the time-to-detection and time-to-rollback.
- Identify the release-gate stage that should have caught the issue.
  Cross-reference [`docs/release-gate.md`](../release-gate.md) and
  AMP91-CI-003.
- File follow-ups for any gaps surfaced during the rollback (missing
  backup, missing health check, undocumented env var).

## Cross-references

- [`docs/runbooks/incident-response.md`](./incident-response.md)
- [`docs/runbooks/secret-rotation.md`](./secret-rotation.md)
- [`docs/runbooks/server-deploy.md`](./server-deploy.md)
- [`docs/runbooks/dashboard-deploy.md`](./dashboard-deploy.md)
- [`docs/runbooks/gateway-deploy.md`](./gateway-deploy.md)
- [`docs/release-gate.md`](../release-gate.md)
