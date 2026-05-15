# Runbook — Dashboard (`apps/web`)

## Scope

The Rulebound dashboard is a Next.js 16 app under `apps/web/`. It is a
**preview** surface — a self-hosted audit viewer with passcode-gated
access. There is no SaaS dashboard; there is no SSO; there is no
per-user RBAC.

This runbook walks an operator through deploying one dashboard
instance in front of one `@rulebound/server` instance.

## Pre-deploy checklist

| Item | Required | Notes |
| --- | --- | --- |
| Node.js 22.x | Yes | Next.js 16 runtime. |
| `RULEBOUND_API_URL` | Yes | Server's URL (the dashboard proxies to it server-side; see `apps/web/lib/server-proxy.ts`). |
| `RULEBOUND_API_TOKEN` | Yes | Bearer token used by the dashboard's server-side proxy to authenticate to `@rulebound/server`. Scope: minimal (`read`, `audit:read`, `compliance:read`). |
| `RULEBOUND_DASHBOARD_PASSCODE` | Yes | Shared secret that gates dashboard sessions (`apps/web/lib/dashboard-auth.ts`). |
| TLS termination | Yes | Dashboard speaks plain HTTP; terminate TLS at the reverse proxy. |
| Single deployment per trust boundary | Yes | See "Trust boundary" below. |
| Server (`@rulebound/server`) reachable | Yes | Dashboard cannot run standalone. |

## Trust boundary — what the dashboard is **not**

This is intentionally a small surface:

- **No org membership / no SSO / no role enforcement.** Anyone with
  `RULEBOUND_DASHBOARD_PASSCODE` has the same authority. Treat the
  passcode as a high-trust secret.
- **One deployment per trust boundary.** If two teams should not see
  each other's audit log, deploy two dashboards pointed at two
  servers. Do not share a passcode across teams.
- **Passcode-only session.** Sessions are a cookie whose value equals
  the passcode (`apps/web/lib/dashboard-auth.ts:12-15`). Anyone who
  obtains the cookie or the passcode is authenticated. Rotate
  immediately on suspected leak.
- **Server-side proxy only.** The dashboard never exposes the server's
  bearer token to the browser. The browser hits `apps/web/api/*`
  routes; those routes attach the server token in
  `apps/web/lib/api.ts`. Do **not** publish `RULEBOUND_API_TOKEN` to
  the browser via a `NEXT_PUBLIC_*` env var.

## Deploy steps

### 1. Build

```sh
git clone https://github.com/rulebound/rulebound.git
cd rulebound
pnpm install --frozen-lockfile
pnpm --filter @rulebound/web build
```

Output: `.next/` directory. The dashboard runs as a long-lived Node
process via `next start` or behind a reverse proxy.

### 2. Configure env

Place in your secret manager / `.env.production`:

```env
RULEBOUND_API_URL=https://api.rulebound.internal
RULEBOUND_API_TOKEN=rb_<from-server-runbook>
RULEBOUND_DASHBOARD_PASSCODE=<openssl rand -base64 32>
```

The passcode is **shared**, not per-user. There is no user table.

### 3. Run

```sh
pnpm --filter @rulebound/web start
# listens on PORT (default 3000)
```

For systemd or container deployment, package `apps/web/.next/`,
`apps/web/public/`, and the `apps/web/package.json` together. Set
`NODE_ENV=production`.

A container image and helm chart are **out of scope for v0.1**. If you
need one, build it locally — example Dockerfile:

```dockerfile
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && \
    pnpm --filter @rulebound/web build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
```

### 4. Place behind a reverse proxy

The dashboard's HTTP responses include the session cookie
(`rulebound_dashboard_session`). The proxy must:

- Terminate TLS.
- Forward `Cookie` and `Authorization` headers.
- Set `Strict-Transport-Security`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff` (the dashboard does not set these
  itself in v0.1).
- Restrict access to a private network or behind a VPN if the audit
  data is sensitive.

### 5. First login

Navigate to `/access`. Enter the passcode. The dashboard sets the
session cookie and redirects to `/`. Subsequent requests pass
`assertDashboardSession` in `apps/web/lib/dashboard-auth.ts`.

If the passcode is unset (`RULEBOUND_DASHBOARD_PASSCODE` empty), the
dashboard redirects to `/access?error=missing-config` and refuses to
authenticate (per `getDashboardPasscode()` returning `null`). This is
the correct behavior; do **not** set a placeholder passcode to bypass
this state.

## Post-deploy verification

1. **Health check:** `curl https://<dashboard-host>/access` returns
   the access page (HTTP 200). No login required for `/access` itself.
2. **Config check:** Hit `/api/v1/rules` directly (unauthenticated).
   Expected: 401 with `{"error":"Dashboard authorization required."}`
   (`apps/web/lib/server-proxy.ts:64-71`).
3. **Server proxy check:** With a valid session cookie, hit
   `/api/v1/rules`. Expected: the server's response, proxied. If the
   server is unreachable, the proxy returns 5xx with a `code` field.
4. **Cookie check:** Inspect the `Set-Cookie` header after login.
   Verify `HttpOnly`, `Secure` (in production), and `SameSite=Lax`.
5. **Cross-origin check:** Issue a `POST` from a different origin.
   Expected: 403 `{"error":"Cross-origin request rejected."}` from
   `isSameOriginRequest` (`apps/web/lib/server-proxy.ts:24-45,53-58`).

## Rollback procedure

Dashboard rollback is process-only — no persistent state in the
dashboard itself.

1. Stop the new version (`systemctl stop rulebound-dashboard` or
   equivalent).
2. Re-deploy the previous build artifact.
3. Start the old version.
4. Verify `/access` and one authenticated route.

Session cookies are stable across versions as long as
`RULEBOUND_DASHBOARD_PASSCODE` does not change. Rolling back does
**not** require users to re-authenticate.

If the dashboard rollback is triggered by a server-side incident (the
underlying API broke), see [`server-deploy.md`](./server-deploy.md) for
server rollback steps. The dashboard is forward-compatible with older
servers as long as the `/v1/*` JSON shapes are stable.

## Operational notes

- The dashboard's server-side proxy
  (`apps/web/lib/server-proxy.ts:85-88`) **passes through upstream
  response bodies verbatim**, including 4xx/5xx error JSON. If the
  upstream `@rulebound/server` returns an error body containing an
  Authorization header (e.g. from a misconfigured backend echoing the
  inbound request), that value will reach the browser. AMP91-SEC-004
  Team B follow-up tracks adding `redactSensitive()` to the upstream
  pass-through path; the `it.todo` in
  `apps/web/__tests__/dashboard-proxy-redaction.test.ts` is the
  hand-off marker.
- The proxy enforces same-origin for mutating methods (POST, PUT,
  PATCH, DELETE). Read requests are unrestricted by the proxy but
  still require a valid session cookie.
- The dashboard does **not** persist user activity. Audit lookups
  happen server-side via the API. Logs from the Next.js process
  contain request paths but should not contain the session cookie or
  the `RULEBOUND_API_TOKEN`.
- WCAG AA accessibility audit is covered separately under
  AMP91-WEB-004. Out of scope for this runbook.

## Cross-references

- [`docs/runbooks/server-deploy.md`](./server-deploy.md) — the server
  the dashboard talks to.
- [`docs/runbooks/secret-rotation.md`](./secret-rotation.md) — passcode
  and API token rotation.
- [`docs/threat-model/server.md`](../threat-model/server.md) — server
  threats inherited by the dashboard (token theft, CORS, audit PII).
- [`docs/dashboard-readiness.md`](../dashboard-readiness.md) — what is
  and is not in v0.1 for the dashboard.
