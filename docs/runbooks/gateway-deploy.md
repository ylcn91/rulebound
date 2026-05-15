# Runbook — Gateway (`@rulebound/gateway`)

## Scope

`@rulebound/gateway` is an LLM proxy that sits between an LLM client
and the provider (OpenAI / Anthropic / Google). It is a **preview /
advanced** surface. Rulebound does **not** offer a hosted gateway.

This runbook assumes you have already decided the gateway is worth the
operational cost. If your day-one need is CI gating, the answer is
`rulebound check` and MCP — **not** the gateway.

## Pre-deploy checklist

| Item | Required | Notes |
| --- | --- | --- |
| Node.js 22.x | Yes | Runtime. |
| Private network placement | Yes | The gateway has **no inbound auth**. Public exposure = open proxy. |
| `GATEWAY_PORT` reachable only from clients | Yes | Set ingress rules accordingly. |
| `OPENAI_TARGET_URL` / `ANTHROPIC_TARGET_URL` / `GOOGLE_TARGET_URL` reviewed | Yes | Defaults point to the official provider URLs. Any override must be audited against GW-T2. |
| `RULEBOUND_SERVER_URL` + `RULEBOUND_API_KEY` | Conditional | Only if telemetry is enabled. |
| `RULEBOUND_PROJECT` / `RULEBOUND_STACK` | Recommended | Drives rule selection for the cache. |
| `DEBUG_FULL_BODIES` **unset** | Yes — **production-NO** | See "DEBUG_FULL_BODIES — production-NO" below. |
| Rule cache source decided | Yes | Local `.rulebound/rules` vs server-fetched. |

## DEBUG_FULL_BODIES — production-NO

`DEBUG_FULL_BODIES=1` (`packages/gateway/src/proxy.ts:77`) is a
diagnostic flag that **logs LLM prompts and responses** into the
structured logger. In production this writes user prompts, system
prompts, response bodies (up to 10 KB), violation arrays, and
streaming buffers to whatever log aggregator the process talks to.

Operator rules:

- **Never set this in any non-local environment.**
- After AMP91-GW-002 (Team B Wave 2) ships, the gateway logs a startup
  warning when the flag is set. Treat that warning as an immediate
  rollback signal in production.
- The flag is intentionally hard-coded as `process.env.DEBUG_FULL_BODIES
  === "1"`. There is no way to "partially enable" it. Either off or
  full bodies.

If you need a one-off prompt trace for debugging, run a separate
gateway instance in a sandbox, set the flag there, replay the request,
and tear the instance down.

## Provider credentials forwarding

The gateway is intentionally a **dumb proxy** with regard to upstream
authentication. The inbound client provides the provider's
`Authorization` header (e.g. `Bearer sk-…`), and the gateway forwards
that header unchanged to `OPENAI_TARGET_URL` (or the configured
target). See `forwardHeaders` in
`packages/gateway/src/proxy.ts:419-430` — only `Host` and
`Content-Length` are dropped.

Consequences:

- The gateway does **not** require its own provider key. It forwards
  whatever the client sent.
- A misconfigured `OPENAI_TARGET_URL` (e.g. pointing at an
  attacker-controlled host) will ship the client's provider key to
  that host. **Validate target URLs in the deploy pipeline.**
- The gateway's `RULEBOUND_API_KEY` is **separate** from any provider
  key. It is the bearer token the gateway uses to fetch rules from
  `RULEBOUND_SERVER_URL` (`packages/gateway/src/rule-cache.ts`) and to
  emit telemetry.

If your clients use header-based provider keys (Anthropic's
`x-api-key`, Google's `?key=…`), those are forwarded too.

## Network placement

| Topology | Verdict |
| --- | --- |
| Same Kubernetes namespace as clients, no Ingress | OK. |
| VPC-private, accessible from a known security group | OK. |
| Behind an authenticating reverse proxy (mTLS, signed JWT) | OK. |
| Public internet, password-only at the proxy | **Not OK** — GW-T6. |
| Public internet, no proxy | **Not OK** — open proxy + telemetry leakage. |

The gateway exposes `/health` unauthenticated. Treat that endpoint as
public regardless of the rest of the placement.

## Deploy steps

### 1. Build

```sh
git clone https://github.com/rulebound/rulebound.git
cd rulebound
pnpm install --frozen-lockfile
pnpm --filter @rulebound/gateway build
```

Output: `packages/gateway/dist/`.

### 2. Configure env

Required minimum:

```env
GATEWAY_PORT=4000
RULEBOUND_PROJECT=<project-slug-or-id>
RULEBOUND_STACK=typescript,react
RULEBOUND_ENFORCEMENT=moderate
# Provider targets — verify against official URLs.
OPENAI_TARGET_URL=https://api.openai.com
ANTHROPIC_TARGET_URL=https://api.anthropic.com
GOOGLE_TARGET_URL=https://generativelanguage.googleapis.com
```

If using server-fetched rules and telemetry:

```env
RULEBOUND_SERVER_URL=https://api.rulebound.internal
RULEBOUND_API_KEY=rb_<from-server-runbook>
```

Disable telemetry (no telemetry leak risk per GW-T4):

```env
RULEBOUND_AUDIT_LOG=false
```

### 3. Run

```sh
pnpm --filter @rulebound/gateway start
```

The gateway logs `Chat request received` on every chat-path POST
(`packages/gateway/src/proxy.ts:127`). Default logs do **not** include
prompt/response bodies; only metadata (`reqId`, `provider`, `model`,
`streaming` flag, response status, content length).

A container image and helm chart are **out of scope for v0.1**. Below
is a minimal manual container example:

```dockerfile
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && \
    pnpm --filter @rulebound/gateway build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=builder /app/packages/gateway/dist ./dist
COPY --from=builder /app/packages/gateway/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 4000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

### 4. Wire clients

Point your LLM clients at the gateway. For an OpenAI client:

```ts
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // still required, forwarded by gateway
  baseURL: "https://gateway.internal/openai/v1",
});
```

For Anthropic clients, use `https://gateway.internal/anthropic` or
`/v1/messages` directly (both route to the Anthropic adapter).

## Post-deploy verification

1. **Health check:** `curl https://gateway.internal/health` returns
   `{"status":"ok","type":"gateway","version":"0.1.0"}`.
2. **Passthrough check:** `GET https://gateway.internal/openai/v1/models`
   with a valid `Authorization` header should return the OpenAI model
   list.
3. **Chat scan check:** A POST to `/openai/v1/chat/completions` with a
   prompt that triggers a known rule should return:
   - `enforcement: "advisory"` — 200 with appended warning.
   - `enforcement: "moderate"` or `"strict"` and a violation — 422
     `{"error":{"message":"Rulebound: Code violations detected. Request blocked.","type":"rulebound_violation","violations":[…]}}`
     (`packages/gateway/src/proxy.ts:237-243`).
4. **DEBUG_FULL_BODIES check:** Inspect the startup log. After
   AMP91-GW-002 ships, an unintended `DEBUG_FULL_BODIES=1` will print a
   `WARN` line. If you see it in production, stop the deploy and
   rotate logs that captured prompts (`incident-response.md`).
5. **Telemetry check (optional):** If `RULEBOUND_SERVER_URL` is set,
   confirm a `violation.detected` record appears in the server's
   `auditLog` after step 3.

## Rollback procedure

The gateway is stateless. Rollback = redeploy previous version.

1. Drain inbound traffic (mark the gateway pod / instance unhealthy
   via the load balancer).
2. Stop the new version.
3. Deploy the previous tag / image.
4. Restore traffic.

Streaming responses in flight are lost; clients see a connection
reset. This is acceptable for a stateless proxy.

If the rollback is triggered by a prompt-leak incident
(`DEBUG_FULL_BODIES=1` in prod, or a logging misconfiguration), refer
to [`incident-response.md`](./incident-response.md) for log purge
steps.

## Operational notes

- Streaming responses are scanned chunk-by-chunk via
  `StreamScanner` (`packages/gateway/src/interceptor/stream-scanner.ts`).
  The scanner buffer is **uncapped** in v0.1 — long streams from a
  chatty model can grow memory. AMP91-GW-003 (Team B Wave 2) adds
  max-buffered-bytes. Until then, set a process memory limit
  (cgroups, `--max-old-space-size`) as defense in depth.
- Non-streaming responses are fully buffered via
  `await targetResponse.text()` (`proxy.ts:170`). Cap upstream
  responses at the reverse proxy if you talk to non-canonical
  providers.
- The gateway forwards every inbound header except `Host` and
  `Content-Length` (`forwardHeaders` at `proxy.ts:419-430`). This
  includes `Cookie`, custom `X-*` headers, and any auxiliary auth
  headers. Audit your inbound client to ensure it does not send
  cross-system headers by accident.
- The gateway is **not a prompt-injection defense**. It scans response
  *code blocks* for violations against project rules. It does not
  parse user prompts for injected instructions targeting downstream
  tools. See GW-T10.

## Cross-references

- [`docs/threat-model/gateway.md`](../threat-model/gateway.md) — GW-T1
  through GW-T10.
- [`packages/gateway/docs/gateway-readiness.md`](../../packages/gateway/docs/gateway-readiness.md)
  — preview boundary statement.
- [`docs/runbooks/incident-response.md`](./incident-response.md) —
  prompt leak triage.
- [`docs/runbooks/secret-rotation.md`](./secret-rotation.md) —
  `RULEBOUND_API_KEY` rotation; provider key rotation lives in the
  provider's own runbook.
