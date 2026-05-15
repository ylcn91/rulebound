# Server API Scope Taxonomy (Design)

Status: design-only. Wave 1 produces this contract; Wave 2 introduces the
middleware that enforces it. **No route currently checks scopes** — see
`server-readiness.md` "Required before prod-ready".

Owner: Team B (preview surfaces hardening). Lead verdict reference: B4.

## Goals

1. Make the smallest scope grant useful (read-only audit access) safe to issue
   without giving away write capabilities.
2. Avoid coarse "admin / read / write" buckets that force operators to grant
   too much for narrow integrations.
3. Pick a shape we can extend without a token-table migration. Scopes are a
   `text[]` on `api_tokens` already; the cost of adding new scope strings is
   zero, but renaming or splitting is breaking.

## Scope set (v0.2 contract)

Eleven scopes, in two axes:

- **Resource**: `rules`, `projects`, `audit`, `tokens`, `webhooks`,
  `validate`, `compliance`, `sync`.
- **Verb**: `read`, `write`, `run`. `read` lists/inspects; `write` creates,
  updates, deletes; `run` executes an action (validation, sync).

| Scope | Capability |
| --- | --- |
| `rules:read` | List, fetch, version-history for rules and rule sets. |
| `rules:write` | Create / edit / delete / re-version rules and rule sets. |
| `projects:read` | List and inspect projects, project-rule-set mappings. |
| `projects:write` | Create / update / delete projects and project mappings. |
| `audit:read` | List and export audit log entries. |
| `audit:write` | Insert audit entries (reserved for first-party CLI/MCP; not granted to user-facing tokens by default). |
| `tokens:write` | Create, rotate, revoke API tokens. |
| `webhooks:write` | Create / update / delete webhook endpoints; trigger a delivery test. |
| `validate:run` | Call `/v1/validate/*` to validate code or plans against rules. |
| `compliance:read` | Read compliance snapshots and scores. |
| `sync:write` | Push rule-sync state from a client (gateway, CLI). |

A token without any matching scope receives `403 { error, code: "missing_scope", required: [...] }` for the route it tried to reach.

### Why not more scopes

- `analytics:read` is currently public per `api/analytics.ts`; promoting it to
  authenticated-only is a Wave 2 decision, not part of this taxonomy.
- `compliance:write` is not needed: snapshots are written by the server in
  response to validation runs, not by clients. If a future client needs to
  back-fill snapshots, add the scope at that point.
- `sync:read` overlaps `projects:read`; collapse into the existing one.

### Why not fewer scopes

A `read / write / admin` triple grants webhook write to every dashboard user
who needs to read rules. Operators have asked for the opposite (audit-readers
without webhook authority). Fine-grained scopes can be folded into bundles
in the UI layer; the API contract stays narrow.

## Default scopes at token creation

Today `api/tokens.ts` writes `["read", "validate"]` when the request omits
scopes. These two strings are part of the legacy taxonomy and are not in the
new set. New default (v0.2 onwards):

```
["audit:read", "rules:read", "validate:run"]
```

Write scopes (`*:write`) are opt-in: callers must enumerate them on the
create-token request. The dashboard token-create UI should surface a checklist
matching this taxonomy.

## Legacy compatibility plan

Existing tokens issued before v0.2 carry the legacy strings `"read"` and / or
`"validate"`. The middleware (Wave 2) honours this mapping:

```
"read"     -> ["audit:read", "rules:read", "projects:read", "compliance:read"]
"validate" -> ["validate:run"]
```

### Deprecation timeline

The legacy bypass is **explicitly time-bound**. Operators must migrate before
v0.3.0; the bypass is not a permanent escape hatch.

| Release | Behaviour |
| --- | --- |
| v0.2.x (current) | Middleware accepts legacy + new strings. Per-request `warn` log on first sighting of a legacy string. `RULEBOUND_LEGACY_TOKEN_SCOPES=1` opt-in still treats an empty scope array as "all scopes". `warnLegacyTokenScopesEnv()` emits a **boot-time** `warn` line so the deprecation is visible even when no traffic hits a guarded route. |
| v0.3.0 | `RULEBOUND_LEGACY_TOKEN_SCOPES` becomes a **no-op** (always treated as `0`). Tokens with an empty `scopes` array stop authenticating against guarded routes. Legacy string mapping above is retained one more minor for backward compatibility. |
| v0.4.0 | Drop the legacy string mapping. Tokens carrying only `"read"` or `"validate"` receive `401 { error, code: "scope_renamed", action: "rotate_token" }`. Schema (`api_tokens.scopes text[]`) does not change; only the runtime treatment of the strings does. |

The matching test in `__tests__/scopes.test.ts` (Wave 2) covers each
transition. The boot-time deprecation log is verified in
`__tests__/legacy-scopes-warn.test.ts`.

### Operator migration checklist

1. Run `node packages/server/dist/index.js` against your staging env. If the
   boot-time `warn` line `RULEBOUND_LEGACY_TOKEN_SCOPES=1 is enabled` appears,
   you are relying on the bypass.
2. List tokens whose `scopes` column is empty (`SELECT id FROM api_tokens
   WHERE scopes = '{}'`). These tokens authenticate today but will be
   rejected in v0.3.0.
3. Rotate or update each one with an explicit scope list. New default is
   `["audit:read", "rules:read", "validate:run"]`; add write scopes only when
   the caller needs them.
4. Re-deploy without `RULEBOUND_LEGACY_TOKEN_SCOPES=1` set. The per-request
   deprecation log should stop firing.

## Validation rules

When a new token is created (`POST /v1/tokens`) the request body's `scopes`
array (Wave 2) is validated against this taxonomy. Unknown strings are
rejected with `400 { error, code: "unknown_scope", scope: "<value>" }`. Legacy
strings are accepted with a deprecation header `Deprecation: true` and an HTTP
`Sunset` header pointing at the v0.4.0 release.

## Cross-team contract notes

- Team C SDK-001 contract test (per lead-decisions §2.6) reads
  `packages/server/src/schemas.ts`. The scope enum constant lands in
  `packages/server/src/lib/scopes.ts` in Wave 2; the SDK contract test will
  intentionally fail until Team C updates its types to match. That is the
  designed drift signal.
- The 11-scope list is binding (lead verdict B4). Adding scopes later is
  additive and safe. Removing or renaming a scope is breaking and requires a
  fresh lead verdict.

## Open questions deferred to Wave 2

1. Should the middleware allow `*:write` to imply `*:read`? Recommendation:
   no — keep them orthogonal so the principle of least privilege survives.
2. Should `audit:write` ever be granted to a user-facing token, or only
   issued internally to the CLI/MCP for evidence ingestion? Recommendation:
   the latter; the dashboard UI hides this scope from operators.
3. Token-creation UI ergonomics (preset bundles like "read-only dashboard"
   vs raw scope checklist) belongs to AMP91-WEB-004 and is out of scope here.
