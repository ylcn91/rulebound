# Gateway Readiness

Status of `@rulebound/gateway` for production deployment. The gateway is an
optional, advanced surface for users who want rule injection and post-response
scanning of LLM traffic. The product wedge is CLI + MCP + CI; **do not deploy
the gateway in a customer-facing path before the items in "Not hardened" are
resolved.**

## Hardened

- **No prompt/response body logging by default.** The proxy logs request
  metadata (request id, provider, model, content length, streaming flag,
  enforcement mode) but not user prompts, system prompts, model output, or
  the violation `codeSnippet` payloads. To re-enable full-body logs locally
  for debugging, set `DEBUG_FULL_BODIES=1` in the environment. Do not enable
  this in production.
- **Structured-log redaction.** All `logger.*` calls go through
  `@rulebound/shared/logger`, which redacts `Authorization`, `auth`, `Cookie`,
  `Set-Cookie`, `X-API-Key`, and any field whose key ends in `token`, `key`,
  `secret`, `password`, or `passphrase` (case-insensitive) before the entry
  is serialized.
- **Advisory findings never block.** Semantic / LLM-assisted findings from
  the engine are surfaced as warnings on the response but never cause the
  gateway to return 422 / cut a stream short. Only deterministic
  post-response findings (currently the AST scanner) can trigger a block,
  and only when `enforcement` is `moderate` or `strict`. See
  `src/interceptor/enforcement.ts`.

## Verified by tests

The hardening claims above are covered by automated tests. If any of these
fail, the corresponding claim above is no longer true.

| Claim | Test file | Test name |
| --- | --- | --- |
| No prompt body in stdout/stderr without `DEBUG_FULL_BODIES=1` | `src/__tests__/body-leak.test.ts` | `does not emit user prompt or response body to stdout/stderr without DEBUG_FULL_BODIES` |
| No system-prompt body in stdout/stderr without `DEBUG_FULL_BODIES=1` | `src/__tests__/body-leak.test.ts` | `does not emit system prompt content when injecting rules` |
| Advisory-only summary derives `hasMustViolation=false` | `src/__tests__/enforcement.test.ts` | `never blocks gateway requests on semantic/advisory-only violations` |
| `shouldBlockForMode` consumes only deterministic findings | `src/__tests__/enforcement.test.ts` | `never blocks gateway requests on semantic/advisory-only violations` |
| AST errors map to MUST, AST warnings map to SHOULD | `src/__tests__/enforcement.test.ts` | `treats AST errors as MUST-level and warnings as SHOULD-level with penalties` |
| Real HTTP upstream response is forwarded unchanged | `src/__tests__/fake-upstream.test.ts` | `forwards the proxied response unchanged and never blocks on advisory findings` |
| Real HTTP upstream passthrough is byte-equal | `src/__tests__/fake-upstream.test.ts` | `returns the upstream body byte-equal for non-chat passthrough endpoints` |
| Strict mode blocks on deterministic AST findings | `src/__tests__/integration.test.ts` | `blocks violating responses in strict mode` |
| Moderate mode blocks when AST penalties drop the score | `src/__tests__/integration.test.ts` | `blocks in moderate mode when AST penalties drop the score below threshold` |
| Streaming responses terminate on deterministic block | `src/__tests__/integration.test.ts` | `terminates Gemini streams in moderate mode with a violation event` |

The fake-upstream test (`fake-upstream.test.ts`) spins a Node `http.createServer`
on a random localhost port — no external network is involved.

## Not hardened (deferred — do not treat as production-ready)

- **Provider API drift.** The gateway speaks OpenAI, Anthropic, and Google
  shapes today. Provider APIs change; there are no automated upstream-shape
  contract tests and no version pinning. Treat the gateway as best-effort
  for current API revisions; do not rely on it for SLA-bound integrations.
- **Streaming complexity.** SSE buffering, fence detection, and chunk
  re-emission are non-trivial and have only unit-level coverage. Edge cases
  (mid-fence cancellations, non-standard SSE framing, byte-split UTF-8
  continuations) may misbehave under real provider traffic.
- **No upstream allowlist.** `targets.*` accept any HTTPS URL. If you expose
  the gateway publicly, lock down the targets via environment configuration
  and a reverse proxy.
- **No authentication on the gateway port.** The proxy forwards whatever
  bearer token the client supplies to the upstream provider. Anyone with
  network access to the gateway can use it; deploy behind a private network
  or an authenticating reverse proxy.
- **No rate limiting.** Same as the server: deploy behind a proxy that
  enforces limits per token and per IP.
- **No persistent audit trail.** Violation telemetry is written via
  `recordValidationEvent` to the local filesystem. There is no DB-backed
  audit log of which prompts triggered which violations.
- **No content-encoding handling.** The gateway strips `content-encoding`
  on passthrough to avoid double-decompression issues; this means upstream
  gzip/br responses are decoded before re-emission. Acceptable for current
  use; document the bandwidth implications for large responses.
- **Privacy implications.** Even with body logging disabled, prompt and
  response content transits the gateway process memory. Treat the gateway
  host as a sensitive system; do not co-locate with low-trust workloads.

## Required before "prod-ready" label

1. Add contract tests against fake upstreams for each provider shape and
   pin the supported API revisions in docs.
2. Add an authenticating proxy layer (or document the exact reverse-proxy
   pattern) in front of the gateway.
3. Document and ship a target-URL allowlist; reject unknown upstreams.
4. Run a soak test with realistic streaming traffic; verify stream
   cancellation, multibyte boundary, and large-response behavior.
5. Add an end-to-end privacy-mode test that asserts no prompt/response
   content appears in stdout/stderr when `DEBUG_FULL_BODIES` is unset.

## Deployment topology

The gateway is a self-hosted process. There is no Rulebound-operated proxy.
The intended placement is a private subnet behind an authenticating reverse
proxy, with outbound HTTPS to provider endpoints.

```
+----------------+        +---------------------+        +---------------+
|  Agent / IDE   |  --->  |  Reverse proxy      |  --->  |  Rulebound    |
|  (your LAN)    |        |  (auth, rate limit) |        |  gateway      |
+----------------+        +---------------------+        +-------+-------+
                                                                  |
                                                                  | HTTPS
                                                                  v
                                                       +---------------------+
                                                       |  LLM provider API   |
                                                       |  (OpenAI/Anthropic/ |
                                                       |   Google)           |
                                                       +---------------------+
```

Operator responsibilities at each hop:

- **Reverse proxy.** Terminates TLS, enforces per-token / per-IP rate limits,
  and authenticates the caller (the gateway port itself does **not**
  authenticate; see "Not hardened"). Cloudflare, nginx, an API gateway, or a
  mesh sidecar are all acceptable.
- **Gateway process.** Runs as a single-tenant workload. Do not co-locate
  with low-trust services on the same host; prompt and response content
  transits process memory even with body logging disabled.
- **Provider egress.** The gateway forwards whichever bearer token the caller
  supplied. Outbound network policy is the operator's responsibility — there
  is no upstream allowlist baked into the binary.

Operational requirements for any deployment that handles real LLM traffic:

- Bind the gateway port to a private interface or a service-mesh socket;
  never expose `:4000` (or whichever port) directly to the public internet.
- Provision the reverse proxy with auth and rate limiting before sending the
  first real request through the gateway.
- Treat the gateway host as a secrets-bearing system; rotate provider keys
  on host compromise.

## No hosted proxy promise

There is no Rulebound-operated gateway as a service. The `@rulebound/gateway`
package is self-hosted only. Treat any commercial-sounding language about
"Rulebound gateway" as referring to this self-hosted binary, never a managed
SaaS.

- The Rulebound team does not operate a shared proxy that forwards
  customer LLM traffic.
- Provider API keys are forwarded verbatim by the operator's own gateway
  process. Rulebound never observes them.
- The gateway is positioned as a controlled-beta surface (lead verdict B7);
  the master plan section 10 explicitly lists "Gateway hosted proxy offering"
  as out of scope until core readiness.
- If a future Rulebound product offers managed-proxy capabilities, it will
  be announced separately with its own privacy/audit posture; until then,
  self-hosted is the only supported topology.

## Configuration reference

| Env var | Effect |
| --- | --- |
| `DEBUG_FULL_BODIES=1` | Re-enables full prompt/response logging. Default off. Never set in production. |
| `RULEBOUND_ENFORCEMENT` | `advisory` (default), `moderate`, or `strict`. Only affects deterministic findings. |
| `RULEBOUND_INJECT_RULES` | Set to `false` to disable rule injection. |
| `RULEBOUND_SCAN_RESPONSES` | Set to `false` to disable post-response scanning. |
| `RULEBOUND_AUDIT_LOG` | Set to `false` to disable telemetry recording. |
