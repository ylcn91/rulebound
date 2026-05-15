# Native SDK parity matrix

**Status:** v0.1 enforcement. Hand-written SDKs, no OpenAPI client
generation (per lead-decision **C3** —
[`.claude/lead-decisions.md`](../../.claude/lead-decisions.md)).
Re-visit trigger for generation: 30+ public endpoints OR two production
drift incidents.

Canonical reference: `@rulebound/sdk` (TypeScript). All native SDKs
match the TS SDK's request/response shapes, query parameter naming, and
error envelope handling for the endpoints listed below.

## Tier 1 — MUST be parity-tested on every native SDK

These six endpoints back the core agent + CI workflows (read rules,
validate a plan, sync the rule pack to a project, list audit history).
A native SDK that does not pass Tier 1 parity tests is not eligible to
ship.

| Endpoint | HTTP | TS SDK method | Why Tier 1 |
| --- | --- | --- | --- |
| `GET /v1/rules` | GET | `listRules(options)` | Foundation for any rule-loading flow. |
| `GET /v1/rules/:id` | GET | `getRule(ruleId)` | Foundation for single-rule lookup. |
| `POST /v1/validate` | POST | `validate(request)` | The advisory plan/code validation endpoint. |
| `GET /v1/sync` | GET | `syncRules(options)` | Pull canonical rule set for a project. |
| `POST /v1/sync/ack` | POST | `ackSync(input)` | Acknowledge sync receipt for drift tracking. |
| `GET /v1/audit` | GET | `listAudit(options)` | Read audit history (the read-side of compliance). |

Enforcement: [`.github/workflows/sdk-parity.yml`](../../.github/workflows/sdk-parity.yml)
runs every native SDK's test suite on each push and PR. Each SDK's
test suite is required to cover all six Tier 1 endpoints (happy path +
non-2xx error envelope parse).

Per-SDK Tier 1 coverage today (source: each SDK's existing test
suite):

| SDK | `listRules` | `getRule` | `validate` | `syncRules` | `ackSync` | `listAudit` |
| --- | --- | --- | --- | --- | --- | --- |
| TypeScript | yes | yes | yes | yes | yes | yes |
| Python | yes | yes | yes | yes | yes | yes |
| Go | yes | yes | yes | yes | yes | yes |
| Java | yes | yes | yes | yes | yes | yes |
| .NET | yes | yes | yes | yes | yes | yes |
| Rust | yes | yes | yes | yes | yes | yes |

(Verified by reading each SDK's test file at the time of the SDK-002
audit. Cells will turn into matrix-job pass/fail markers once
sdk-parity.yml renders them.)

## Tier 2 — SHOULD be parity-tested when the SDK ships writes

These endpoints land in a native SDK once that SDK adds write support
for the corresponding domain. Not blocking for the v0.1 release; not
blocking for sdk-parity.yml today.

| Endpoint | HTTP | TS SDK method | Notes |
| --- | --- | --- | --- |
| `POST /v1/rules` | POST | `createRule(input)` | Server enforces `rules:write` scope. |
| `PUT /v1/rules/:id` | PUT | `updateRule(id, input)` | Same scope. |
| `DELETE /v1/rules/:id` | DELETE | `deleteRule(id)` | Same scope. |
| `GET /v1/projects` | GET | `listProjects()` | Read-only; promote to Tier 1 if dashboard-equivalent flows land in a native SDK. |
| `GET /v1/projects/:id` | GET | `getProject(id)` | Same. |
| `POST /v1/projects` | POST | `createProject(input)` | Server enforces `projects:write` scope. |
| `PUT /v1/projects/:id` | PUT | `updateProject(id, input)` | Same. |
| `DELETE /v1/projects/:id` | DELETE | `deleteProject(id)` | Same. |
| `POST /v1/audit` | POST | `createAudit(input)` | Server enforces `audit:write` scope. |
| `GET /v1/audit/export` | GET | `exportAudit(options)` | Returns text/CSV; native SDK return shape is language-idiomatic. |
| `GET /v1/compliance/:projectId` | GET | `getCompliance(id, options)` | Read-only. |
| `POST /v1/compliance/:projectId/snapshot` | POST | `createComplianceSnapshot(id, input)` | Server enforces `compliance:write` scope (B4 verdict). |
| `GET /v1/tokens` | GET | `listTokens(options)` | Self-service token listing. |

Per-SDK Tier 2 coverage today is mixed; this is acceptable and not
gated. Tier 2 coverage gaps are tracked per SDK in that SDK's
follow-up issue, not on the parity workflow.

## Tier 3 — Explicitly out of scope for v0.1 native parity

These endpoints are part of the TypeScript SDK because the dashboard
and the canonical reference need them, but native SDKs are **not**
required to implement them for v0.1. They will revisit when (a) a
real native-SDK consumer requests one or (b) the lead-decisions C3
trigger fires (30+ endpoints OR 2 prod drift incidents) and the
project moves to generated clients.

| Endpoint | HTTP | TS SDK method | Out-of-scope reason |
| --- | --- | --- | --- |
| `POST /v1/tokens` | POST | `createToken(input)` | Token issuance is a server-side operator task, not an agent SDK task. |
| `DELETE /v1/tokens/:id` | DELETE | `deleteToken(id)` | Same. |
| `GET /v1/analytics/top-violations` | GET | `getTopViolations(options)` | Dashboard-only analytics. |
| `GET /v1/analytics/trend` | GET | `getAnalyticsTrend(id, options)` | Same. |
| `GET /v1/analytics/category-breakdown` | GET | `getCategoryBreakdown(options)` | Same. |
| `GET /v1/analytics/source-stats` | GET | `getSourceStats(options)` | Same. |
| `GET /v1/webhooks/endpoints` | GET | `listWebhookEndpoints(options)` | Webhook management is an operator surface, not an agent SDK surface. |
| `GET /v1/webhooks/endpoints/:id` | GET | `getWebhookEndpoint(id)` | Same. |
| `POST /v1/webhooks/endpoints` | POST | `createWebhookEndpoint(input)` | Same. Server enforces `webhooks:write` scope. |
| `PUT /v1/webhooks/endpoints/:id` | PUT | `updateWebhookEndpoint(id, input)` | Same. |
| `DELETE /v1/webhooks/endpoints/:id` | DELETE | `deleteWebhookEndpoint(id)` | Same. |
| `POST /v1/webhooks/endpoints/:id/test` | POST | `testWebhookEndpoint(id)` | Same. |
| `GET /v1/webhooks/deliveries` | GET | `listWebhookDeliveries(options)` | Same. |

If a native SDK ships any of the above, it MUST add the corresponding
parity-workflow test. Adding a Tier 3 endpoint does **not** promote
it to Tier 1 — Tier 1 promotion requires a lead-decision update.

## Pinned toolchains

The parity workflow installs the toolchains pinned in
[`.tool-versions`](../../.tool-versions):

- Node.js 22 (TS SDK build + test runner)
- Python 3.12 (Python SDK build + pytest)
- Go 1.22 (Go SDK build + test)
- Java Temurin 21 (Java SDK build + JUnit)
- .NET 8.0 (.NET SDK build + dotnet test)
- Rust 1.75 (Rust SDK build + cargo test)

`.tool-versions` is compatible with both
[mise](https://mise.jdx.dev/) (`mise install`) and
[asdf](https://asdf-vm.com/) (`asdf install`). Developers on either
manager can switch all six toolchains at once at the repo root.

The pinned versions match the matrix in
[`.github/workflows/sdk-parity.yml`](../../.github/workflows/sdk-parity.yml).
A drift between `.tool-versions` and the workflow matrix is a release
gate failure (AMP91-CI-002 toolchain fail-fast policy).

## Error envelope parity

Every native SDK MUST surface the canonical Rulebound error envelope
(`@rulebound/shared`'s `RuleboundError`) on non-2xx HTTP responses.
The envelope shape is `{ error, code, message, details?, retriable? }`
(see [`packages/shared/src/errors.ts`](../../packages/shared/src/errors.ts)).

Per-SDK error-envelope parsing today:

| SDK | Parses canonical envelope (`code`, `details`, `retriable`) | Status |
| --- | --- | --- |
| TypeScript | yes — `parseErrorEnvelope` in `sdks/typescript/src/index.ts` | Shipped in CLN-003. |
| Python | no — raises `RuleboundError(status, body)` with raw body | v0.2 follow-up. |
| Go | no — `APIError{StatusCode, Body}` raw shape | v0.2 follow-up. |
| Java | no — raw status + body | v0.2 follow-up. |
| .NET | no — raw status + body | v0.2 follow-up. |
| Rust | no — raw status + body | v0.2 follow-up. |

The native SDK envelope parsers are **not** Tier 1 gated for v0.1
because:

1. Server-side, only the TS SDK exercises every server route enough
   to surface envelope drift (the dashboard uses the TS SDK).
2. Raw `body` access in each native SDK is sufficient for callers
   that need to peek at envelope fields manually until the parser
   ships.
3. A coordinated synced-semver minor bump (`docs/sdks/versioning.md`)
   is the right vehicle to ship native envelope parsers — they are
   additive on top of the existing error types.

## Out of scope

- OpenAPI / Swagger generation. Reddedildi by lead-decision C3.
  Re-visit on the trigger condition above.
- Native SDK feature surface beyond API client + types (per master
  plan Section 10 — "Out of scope until core readiness").
- A unified "SDK changelog" doc. Each SDK has its own changelog;
  versioning policy is in [`versioning.md`](versioning.md).
