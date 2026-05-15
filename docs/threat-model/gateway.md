# Threat Model — Gateway (`@rulebound/gateway`)

## Surface description

`@rulebound/gateway` is a Hono-based reverse proxy
(`packages/gateway/src/proxy.ts`) that sits between an LLM client and an
LLM provider (OpenAI, Anthropic, Google). It rewrites paths, injects
project rules into the system prompt, scans the response (or stream) for
violations against the loaded rules, and enforces a block/warn policy.

Surface maturity: **preview / advanced — self-hosted only**. There is
**no** Rulebound-hosted gateway. The day-one happy path is the CLI plus
the MCP server. See
[`packages/gateway/docs/gateway-readiness.md`](../../packages/gateway/docs/gateway-readiness.md)
for the deployment boundary statement.

Default routes:

- `/openai/*` → `https://api.openai.com`
- `/anthropic/*`, `/v1/messages/*` → `https://api.anthropic.com`
- `/google/*` → `https://generativelanguage.googleapis.com`
- `/health` — unauthenticated liveness probe.

## Trust boundary

**Inside:** the gateway process, the local rule cache
(`packages/gateway/src/rule-cache.ts`), the configured provider target
URLs, and the inbound LLM client.

**Outside:** the LLM provider's API. The gateway forwards inbound
headers (including `Authorization`) to the provider unchanged
(`packages/gateway/src/proxy.ts:419-430` — `forwardHeaders` drops only
`Host` and `Content-Length`).

The gateway is **not** the trust boundary for the LLM client's
credentials — the client owns those. The gateway is responsible for
not leaking them and not forwarding them to a wrong target.

## Assets behind the boundary

| Asset | Where | Why it matters |
| --- | --- | --- |
| Provider API keys | inbound request `Authorization` header (forwarded by `forwardHeaders`) | Theft → unbounded LLM spend, model misuse. |
| LLM prompts (user) | inbound request body (`messages`, `system`) | PII, IP, credential strings the user typed. |
| LLM responses | upstream response body | Same — model-generated content may include training-data extracts or echoed secrets. |
| Project rules | `RULE_CACHE` / `packages/gateway/src/rule-cache.ts` | Public on disk; not sensitive themselves but reveal project policy. |
| Violation telemetry | `recordGatewayValidationTelemetry` calls | Sent to `RULEBOUND_SERVER_URL` if configured; includes violation messages, code-block counts. |

## Threats

| ID | STRIDE | Description | Mitigation | Residual | Linked task |
| --- | --- | --- | --- | --- | --- |
| GW-T1 | Information disclosure | `DEBUG_FULL_BODIES=1` (`packages/gateway/src/proxy.ts:77`) enables logging of `userPrompt`, `systemPromptPreview`, `responseBody` (up to 10 KB), `contentPreview`, stream `responseContent`, and `violations` arrays into the structured logger (`logger.info` / `logger.warn`). In production, this writes prompt/response bodies into log aggregation systems. | The flag is **off by default** (`DEBUG_FULL_BODIES !== "1"` is the on-test). `bodyDebug()` (`proxy.ts:79-81`) returns `{}` unless the flag is set. AMP91-GW-002 (Team B Wave 2) adds a startup `logger.warn` when `DEBUG_FULL_BODIES=1` is detected so operators are alerted on each boot. AMP91-SEC-004 (Team C Wave 1) parity test confirms default-off behavior. | An operator who flips the flag in a config tool gets a startup warning but no automatic shutoff. **High** if the flag is wired into a production config by mistake. The runbook (`docs/runbooks/gateway-deploy.md`) marks the flag as explicit production-NO. | AMP91-GW-002, AMP91-SEC-004. |
| GW-T2 | Information disclosure / Tampering | `forwardHeaders` (`packages/gateway/src/proxy.ts:419-430`) forwards every inbound header to the upstream **except** `Host` and `Content-Length`. This includes `Authorization` (provider key), `Cookie`, `X-API-Key`, custom headers. The gateway intentionally pipes provider credentials through. The risk: a misconfigured `targets.openai = "https://attacker.example/"` (e.g. operator typo, env var injection) ships the user's OpenAI key to an attacker. | Targets are loaded from env vars (`OPENAI_TARGET_URL`, etc., `packages/gateway/src/config.ts:43-47`) with sensible defaults to the official provider URLs. There is no allowlist of target hostnames; an operator can point to any host. | **High** in any deployment where env management is loose. Runbook (`docs/runbooks/gateway-deploy.md`) requires explicit review of `targets`. | n/a (operator-controlled by design — gateway is a generic proxy). |
| GW-T3 | Tampering / Elevation | Pre-request rule injection rewrites the system prompt (`packages/gateway/src/proxy.ts:135-148`, `provider-adapter.ts:injectRulesForProvider`). A rule with attacker-controlled text would be appended to every system prompt. Rule loading goes through `getCachedRules` against the local `.rulebound/rules` directory or against `RULEBOUND_SERVER_URL`. Compromise of the rules pipeline = control of every system prompt. | The rules directory is the same surface the CLI trusts (already-trusted working tree). If `RULEBOUND_SERVER_URL` is set, the cache fetches over HTTPS with bearer auth (`RULEBOUND_API_KEY`). The cache TTL is bounded (rule-cache.ts). | **Medium**. Sourcing rules from a remote server adds a new dependency; failure modes deferred to AMP91-GW-001 (provider contract fixtures) — they cover provider-side, not rule-source-side. | n/a in core; rule-cache hardening is a v0.2 item. |
| GW-T4 | Information disclosure | Telemetry emission via `recordGatewayValidationTelemetry` (`packages/gateway/src/interceptor/enforcement.ts`) sends violation records to `RULEBOUND_SERVER_URL` when configured. Violation records can carry response content excerpts via `report` shape. If the gateway is in front of a sensitive enterprise model and telemetry goes to a less-trusted server, that is a cross-boundary leak. | Telemetry is enabled by `config.auditLog` (defaults to true). Disabling: `RULEBOUND_AUDIT_LOG=false`. Telemetry endpoint is operator-configured; not phoned-home. | **Medium**. Operator checklist: set `RULEBOUND_AUDIT_LOG=false` or point telemetry to an internal-only server. | AMP91-GW-002. |
| GW-T5 | Tampering | Streaming response scanner accumulates SSE chunks into an in-memory buffer (`packages/gateway/src/interceptor/stream-scanner.ts`). A long-running stream from a chatty model can grow the buffer unboundedly. | The scanner buffer is not size-capped in v0.1. `bodyDebug` slices to 10 KB for logging only; the actual scan buffer is uncapped. Provider disconnect cancels the upstream reader (`reader.cancel("rulebound_violation")` at `proxy.ts:395`) on block, but not on benign EOF. | **Medium**. AMP91-GW-003 (Team B Wave 2) adds max-buffered-bytes, malformed-chunk handling, scan timeout. | AMP91-GW-003. |
| GW-T6 | Spoofing | The gateway has no authentication on inbound calls. Anything reachable on `GATEWAY_PORT` can issue a request that the gateway forwards (with its own headers carrying the inbound `Authorization`). | Network placement: deploy on a private network or with mTLS in front. The runbook (`docs/runbooks/gateway-deploy.md`) marks "no public exposure". | **High** if exposed to the public internet — anyone who can hit the gateway can use it as an open proxy to the provider, with their *own* `Authorization` header. (Note: this is not a credential theft, but it is a free-loading vector and a TOS violation against the provider.) | n/a (operator-controlled). |
| GW-T7 | Elevation | Path detection (`detectProvider`, `proxy.ts:25-29`) routes `/v1/messages` to Anthropic. An attacker request to `/v1/messages/../openai/v1/chat/completions` would fail path detection but `stripProviderPrefix` (`proxy.ts:31-36`) does no path normalization. `URL.search` is preserved (`proxy.ts:102`). | `new URL(targetPath, targetBase)` resolves relative paths against the base; `..` segments cannot escape the host. Method check `method !== "POST" || !isChat` passes through non-POST traffic. | **Low**. Path normalization rests on `URL` semantics, which are well-defined. | n/a. |
| GW-T8 | DoS | Non-streaming response is buffered via `await targetResponse.text()` (`proxy.ts:170`); a 100 MB upstream response would be fully buffered before scanning. | No explicit cap on response size. Provider APIs cap their own response sizes. | **Low** in practice (providers cap responses). Defensive cap recommended in AMP91-GW-003. | AMP91-GW-003. |
| GW-T9 | Information disclosure | Failed `/health` discovery: the gateway's `/health` route (`proxy.ts:87`) responds to any caller and reveals version (`"version": "0.1.0"`). Combined with GW-T6 (no auth), this is a reconnaissance signal. | Acceptable for a private-network deployment; not acceptable on the public internet. The runbook requires private placement. | **Low** given placement requirement. | n/a. |
| GW-T10 | Spoofing (prompt injection) | The gateway *consumes* response content and scans it; it does not detect prompt-injection embedded in the user's own message. If the user pastes attacker-controlled text into a prompt, downstream models may follow injected instructions. The gateway only enforces rules on **code blocks** within responses. | This is by design — prompt injection of LLM payloads is outside what a path-based proxy can solve. The runbook documents this boundary. | **Medium** for naïve users who expect the gateway to be a content firewall. Documented in `docs/runbooks/gateway-deploy.md`. | n/a. |

## Operator checklist

- **Never** set `DEBUG_FULL_BODIES=1` in production. Validate at deploy
  time. The startup warn from AMP91-GW-002 is a signal, not a guard.
- Verify `OPENAI_TARGET_URL`, `ANTHROPIC_TARGET_URL`,
  `GOOGLE_TARGET_URL` env vars at deploy time against the official
  provider hosts. Add a config-validation step in your deploy
  pipeline.
- Place the gateway on a private network. Do **not** expose
  `GATEWAY_PORT` to the public internet. The gateway has no inbound
  auth.
- If sending telemetry to `RULEBOUND_SERVER_URL`, ensure the server
  is at the same or higher trust level than the LLM provider.
- Rotate `RULEBOUND_API_KEY` (telemetry token) alongside the server's
  API tokens; treat it as a regular `apiTokens` entry.
- For sensitive workloads, set `RULEBOUND_AUDIT_LOG=false` and disable
  telemetry. Violation enforcement still works locally.
- The gateway is **not** a content firewall; do not rely on it for
  prompt-injection defense.

## Error envelope exception

The gateway's 422 block response intentionally diverges from the canonical
`RuleboundError` envelope (`@rulebound/shared`'s
`{ error, code, message, details?, retriable? }`). Per AMP91-CLN-003 the
gateway 422 shape is an explicit exception and ships as:

```json
{
  "error": {
    "message": "Rulebound: Code violations detected. Request blocked.",
    "code": "rule_violation",
    "type": "rulebound_violation",
    "violations": [
      { "ruleId": "...", "ruleTitle": "...", "severity": "error", "reason": "...", "codeSnippet": "..." }
    ]
  }
}
```

Rationale:

- The nested `error.violations` array is the load-bearing payload for
  consumers building agent-side repair loops; it predates CLN-003 and is
  already public (`packages/gateway/src/__tests__/integration.test.ts:341-343`).
  Flattening it under top-level `details` would be a breaking change for
  every gateway client.
- `error.type === "rulebound_violation"` is the legacy discriminator
  consumers were instructed to switch on. `code: "rule_violation"`
  (CLN-003 addition) is the canonical alias; both fields are emitted for
  the v0.1 window and `type` is scheduled to be removed in v0.2 once
  consumers have migrated.
- The TS SDK's `RuleboundError` parser maps the nested gateway shape to
  the canonical fields: `code` is lifted, `details` is populated with
  `{ type, violations }`. See `sdks/typescript/src/index.ts`'s
  `parseErrorEnvelope`. Consumers of `@rulebound/sdk` therefore see the
  unified shape; raw HTTP consumers see the nested gateway-specific
  shape.

This is the single documented envelope exception in v0.1. All other
gateway error responses (5xx upstream, 4xx auth — none today since the
gateway has no inbound auth, see GW-T6) MUST emit the canonical
envelope when added.

## Open questions

- Should the gateway add a target allowlist (e.g.
  `RULEBOUND_GATEWAY_ALLOWED_TARGETS=api.openai.com,api.anthropic.com`)
  and refuse to start if `OPENAI_TARGET_URL` resolves outside it?
  Recommendation: add in v0.2 as a low-cost defense for GW-T2.
- Should `forwardHeaders` strip `Cookie` and arbitrary `X-` headers by
  default? Today every header passes through. Recommendation: keep
  permissive forwarding for v0.1 to avoid breaking provider features;
  add a deny-list env in v0.2.
- Should `Authorization` be re-checked against a per-tenant allowlist
  before forwarding? Out of scope for v0.1 (no tenant model in the
  gateway).
- AMP91-GW-003 streaming bounds: cap buffer at 4 MB or 16 MB? Defer
  to Team B Wave 2 sizing tests.

## Reviewer sign-off

- Date:
- Reviewer:
- Notes:
