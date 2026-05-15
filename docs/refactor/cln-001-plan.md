# CLN-001 — Large file decomposition plan (audit only)

**Status:** v0.1 audit. **Refactor work is deferred to v0.2** per
lead-decision **C2** in
[`.claude/lead-decisions.md`](../../.claude/lead-decisions.md): a
~1,500-line refactor inside the final production-hardening sprint has the
wrong risk/reward trade-off. This document is the inventory and the
target shape; the refactor itself does not happen now.

Scope: three god-files identified by AMP91-CLN-001. For each: current
size, current structure, proposed target decomposition, test-coverage
state today, and the recommended sequencing for a v0.2 refactor.

| Target file | Size today | Test file | Test LOC | Risk if refactored without expanded tests |
| --- | --- | --- | --- | --- |
| `packages/cli/src/commands/check.ts` | 618 | `packages/cli/src/__tests__/check.command.test.ts` | 420 | Medium — formatters are testable in isolation; the wiring (option parsing → engine call → format selection) is the load-bearing part. |
| `apps/web/lib/dashboard-data.ts` | 448 | `apps/web/__tests__/dashboard-data.test.ts` | 230 | Low — purely IO + transform; integration test surface is small. |
| `packages/gateway/src/proxy.ts` | 441 | `packages/gateway/src/__tests__/{gateway,integration,fake-upstream,post-response,stream-scanner,enforcement,body-leak,provider-contracts,ast-scanner}.test.ts` | 9 files, ~2,500 LOC combined | High — the `app.all("/*")` handler is the request/response branching brain of the gateway. Split must preserve every test's `app.fetch(...)` invocation contract. |

---

## 1. `packages/cli/src/commands/check.ts` (618 lines)

### Current structure

| Lines | Responsibility |
| --- | --- |
| 17-35 | `CheckOptions` interface and constants. |
| 37-94 | Run-context discovery: `detectBranch`, `detectChangedFiles`, `loadContext`. |
| 96-176 | Pretty-printer: `statusColor`, `printPretty`. |
| 178-180 | `printJson` (3 lines including `redactReportSnippets`). |
| 182-247 | GitHub annotations: `printGithub`, `escape`. |
| 250-342 | SARIF builder: `sarifLevel`, `printSarif`. |
| 344-487 | PR markdown: `statusBadge`, `evidenceLine`, `bullet`, `renderPrMarkdown`, `printPrMarkdown`, `escapeCell`. |
| 489-540 | `printRepairJson` — agent-repair-loop payload. |
| 542-557 | `printWaiverErrors` — fan-out across all five format printers. |
| 559-617 | `checkCommand` — the entry point that orchestrates loading + engine call + format dispatch. |

The hot path is `checkCommand` at the bottom calling the formatters
above it. The five formatters (`printPretty`, `printJson`, `printGithub`,
`printSarif`, `printPrMarkdown`, `printRepairJson`) share no state with
each other and are pure functions of `DeterministicReport` (plus, in
the repair-JSON case, the `allowCommands` flag from the run context).

### Proposed target structure

```
packages/cli/src/commands/check/
├── index.ts                    # entry — checkCommand, CheckOptions export
├── context.ts                  # detectBranch, detectChangedFiles, loadContext
└── formatters/
    ├── pretty.ts               # statusColor, printPretty (~80 LOC)
    ├── json.ts                 # printJson (~15 LOC, including waiver-error dispatch)
    ├── github.ts               # printGithub, escape (~65 LOC)
    ├── sarif.ts                # sarifLevel, printSarif (~95 LOC)
    ├── pr-markdown.ts          # statusBadge, evidenceLine, bullet,
    │                           # renderPrMarkdown, printPrMarkdown,
    │                           # escapeCell (~145 LOC)
    ├── repair-json.ts          # printRepairJson (~55 LOC)
    └── waiver-errors.ts        # printWaiverErrors (~20 LOC)
```

Public exports preserved by `index.ts`:

- `checkCommand(opts: CheckOptions): Promise<void>` — already-imported entry.
- `CheckOptions` — type alias.
- `renderPrMarkdown` — currently exported; kept as `export { renderPrMarkdown } from "./formatters/pr-markdown.js"`.

### Test coverage today

`packages/cli/src/__tests__/check.command.test.ts` (420 lines) plus the
new redaction tests (`__tests__/redaction.test.ts`) cover:

- Format selection happy paths (pretty, JSON, repair-JSON, SARIF, GitHub,
  PR markdown).
- Exit-code matrix (AMP91-CLI-002 work).
- Redaction across all four machine-readable formats
  (AMP91-SEC-004 work).
- Waiver-error reporting fan-out.

### Coverage gaps to close before the refactor

1. **`detectBranch` / `detectChangedFiles` / `loadContext` unit tests.**
   These three functions currently sit behind `checkCommand` end-to-end
   tests; the moment they move to `context.ts` they need direct unit
   coverage so the split is enforceable. Today only `checkCommand`
   integration tests exercise them.
2. **`renderPrMarkdown` snapshot test.** The function is exported and
   public but tested only indirectly via the full `printPrMarkdown` exit
   matrix. A direct snapshot pinned per `DeterministicReport` archetype
   (`PASSED`, `FAILED_WITH_WARNINGS`, `FAILED` blocking, waivers present,
   parse errors present) is cheap and would catch any markdown formatter
   regression introduced by the split.
3. **GitHub annotations format pin.** The current test only checks that
   GitHub format runs; an exact string output pin per result archetype
   would prevent silent regression when `escape` moves into
   `formatters/github.ts`.
4. **SARIF schema validation test.** `printSarif` emits a SARIF 2.1.0
   document; a schema-validation pass against the SARIF JSON Schema
   would replace today's structural assertion.

### Recommended refactor order (v0.2)

1. Add the four coverage gap tests above against the current (single
   file) `check.ts`. PR 1 — pure tests, no source change.
2. Extract `formatters/` directory and move each printer one at a time;
   each commit moves one file and updates the in-file import. PR 2-7.
3. Extract `context.ts`. PR 8.
4. Rename `check.ts` to `check/index.ts`. Update the single import in
   `packages/cli/src/index.ts`. PR 9.
5. Verify external API surface (`checkCommand`, `CheckOptions`,
   `renderPrMarkdown`) is byte-identical to v0.1.

### v0.2 sizing estimate

~520 LOC moved across 6 new files + 1 index. No new behavior. Risk
profile is the formatter shapes drifting; the four new tests are the
gate.

---

## 2. `apps/web/lib/dashboard-data.ts` (448 lines)

### Current structure

| Lines | Responsibility |
| --- | --- |
| 3-172 | Type definitions: 18 interfaces for rules, projects, audit, tokens, webhooks, compliance, dashboard overview, analytics. |
| 175-211 | Internal helpers: `buildQuery`, `formatRelativeTime`. |
| 213-417 | Server fetch wrappers: 11 `async function fetch*` calls hitting `/v1/...` via the dashboard's `server-proxy`. |
| 420-447 | `fetchAnalyticsPageData` — composite fetch (top violations + category breakdown + source stats). |

The hot path is the dashboard pages calling `fetchDashboardOverview`,
`fetchAnalyticsPageData`, etc. as React Server Components. Each fetch
function is independent and stateless.

### Proposed target structure

```
apps/web/lib/dashboard-data/
├── index.ts                    # re-export all public functions and types
├── types.ts                    # 18 interfaces (~170 LOC, types only)
├── http.ts                     # buildQuery, server-proxy invocation
├── format.ts                   # formatRelativeTime + future date/number helpers
├── rules.ts                    # fetchRulesList, fetchRuleDetail
├── projects.ts                 # fetchProjectsList
├── audit.ts                    # fetchAuditEntries
├── tokens.ts                   # fetchTokensList
├── webhooks.ts                 # fetchWebhookData
├── compliance.ts               # fetchCompliance, fetchComplianceRows
├── overview.ts                 # fetchDashboardOverview
└── analytics.ts                # fetchAnalyticsPageData
```

Public surface preserved by `index.ts`'s re-exports — every existing
import like `import { fetchDashboardOverview } from "@/lib/dashboard-data"`
continues to resolve unchanged.

### Test coverage today

`apps/web/__tests__/dashboard-data.test.ts` (230 lines) covers:

- `buildQuery` edge cases.
- `formatRelativeTime` edge cases.
- A subset of the fetch wrappers (rules, projects, audit).

### Coverage gaps to close before the refactor

1. **Every fetch function needs at least one test.** Today
   `fetchTokensList`, `fetchWebhookData`, `fetchCompliance`,
   `fetchComplianceRows`, `fetchDashboardOverview`, and
   `fetchAnalyticsPageData` are untested. Each split file should land
   with a happy-path mock + 400/404/500 error-passthrough test.
2. **Server-proxy error envelope contract.** With CLN-003 landing the
   canonical envelope, every fetch function's error-path test should
   assert the `RuleboundError` shape (`code`, `details`, `retriable`) is
   surfaced to the dashboard caller, not swallowed.
3. **Type drift test against `@rulebound/sdk`.** Three of the 18
   interfaces (`RuleRecord`, `ProjectRecord`, `AuditEntry`) duplicate
   shapes that exist in `sdks/typescript/src/index.ts`. A type-level
   `Assignable<>` test (the SDK-001 pattern) would catch divergence.

### Recommended refactor order (v0.2)

1. Add coverage gap tests above against the current (single file)
   `dashboard-data.ts`. PR 1.
2. Extract `types.ts` (pure type move; zero runtime change). PR 2.
3. Extract `http.ts` and `format.ts` helpers. PR 3.
4. Move fetch functions one resource at a time (rules → projects → audit
   → tokens → webhooks → compliance → overview → analytics). PR 4-11.
5. Rename to `dashboard-data/index.ts`. Update the dashboard's tsconfig
   path alias if needed (none expected). PR 12.

### v0.2 sizing estimate

~380 LOC moved across 11 new files + 1 index. No new behavior. Risk
profile is the lowest of the three god-files — it's IO + transforms with
no cross-function state.

---

## 3. `packages/gateway/src/proxy.ts` (441 lines)

### Current structure

| Lines | Responsibility |
| --- | --- |
| 25-36 | `detectProvider`, `stripProviderPrefix` — request path → provider. |
| 38-77 | `getTargetUrl`, `extractSystemPrompt`, `extractUserPrompt`, `bodyDebug` — request/response field extraction (per-provider). |
| 83-86 | `createProxy` entry, Hono `app` construction, `/health` route. |
| 89-275 | `app.all("/*")` — **the entire request lifecycle**: pre-request rule injection, target URL resolution, upstream fetch, streaming branch, non-streaming branch, post-response scan, enforcement (block/warn), 422 violation envelope (now `code: "rule_violation"` — CLN-003). |
| 277-417 | `handleStreamingResponse` — SSE chunk loop, AST scanner, accumulated-buffer scan, violation injection vs cancellation, stream telemetry. |
| 420-441 | `forwardHeaders`, `passthroughHeaders` — header rewriting. |

The hot path is `app.all("/*")` (lines 89-275, ~186 LOC) — the single
biggest block in the file. It branches three times: (a) by streaming vs
non-streaming, (b) by enforcement mode (`strict`/`moderate`/`warn`), (c)
by scan result (violations vs clean). The five gateway test files cover
this branch matrix via `app.fetch(...)` invocations.

### Proposed target structure

```
packages/gateway/src/proxy/
├── index.ts                    # createProxy (entry) + Hono app wiring (~30 LOC)
├── routing.ts                  # detectProvider, stripProviderPrefix,
│                               # getTargetUrl (~30 LOC)
├── prompt-extraction.ts        # extractSystemPrompt, extractUserPrompt,
│                               # bodyDebug, per-provider message shaping
│                               # (~60 LOC)
├── handler-chat.ts             # the app.all("/*") body, but split into
│                               # named pure functions called by it:
│                               # - parseChatRequest
│                               # - resolveUpstream
│                               # - executeUpstream
│                               # - branchOnStreaming
│                               # (~120 LOC)
├── handler-streaming.ts        # handleStreamingResponse + chunk loop
│                               # helpers (~145 LOC)
├── handler-non-streaming.ts    # the non-streaming scan + enforcement
│                               # branch lifted out of app.all (~65 LOC)
├── headers.ts                  # forwardHeaders, passthroughHeaders (~25 LOC)
└── envelope.ts                 # 422 violation response builder; emits
                                # `code: "rule_violation"` + nested
                                # `error.{message,code,type,violations}`
                                # exception (~30 LOC, single source of
                                # truth for the documented gateway
                                # envelope exception)
```

Public surface preserved by `index.ts`:

- `createProxy(config: GatewayConfig)` — the only export anything calls
  from outside the package.

### Test coverage today

Nine test files, ~2,500 LOC combined:

| File | LOC | What it pins |
| --- | --- | --- |
| `gateway.test.ts` | 141 | High-level happy path + provider injection contract. |
| `integration.test.ts` | 647 | The 422 envelope shape, streaming, advisory mode, telemetry. |
| `fake-upstream.test.ts` | (small) | Realistic fake upstream provider fixture. |
| `post-response.test.ts` | (large) | Post-response scan + injection. |
| `stream-scanner.test.ts` | (small) | Stream chunk scan. |
| `provider-adapter.test.ts` | (medium) | Per-provider extraction parity. |
| `provider-contracts.test.ts` | (medium) | AMP91-GW-001 fixtures. |
| `ast-scanner.test.ts` | (medium) | Code-block AST violations. |
| `body-leak.test.ts` | (medium) | `DEBUG_FULL_BODIES` redaction. |
| `enforcement.test.ts` | (medium) | Block / warn / advisory branching. |

This is the highest test density in the repo — refactoring on top of it
is safe **if** every test continues to invoke `createProxy` and
`app.fetch` against the index.

### Coverage gaps to close before the refactor

1. **Direct unit tests for `parseChatRequest`, `resolveUpstream`,
   `executeUpstream`.** These four functions only exist after the
   refactor; they don't have tests today because they are inline in
   `app.all`. Land them with tests in the same PR they're extracted in.
2. **422 envelope shape contract pin.** Test that an
   `error.code === "rule_violation"` + `error.type === "rulebound_violation"`
   are emitted together for the v0.1 + v0.2 deprecation window. (Today
   the integration tests only assert `error.type`.)
3. **Stream-cancellation idempotence test.** When a violation triggers
   `reader.cancel("rulebound_violation")` (`proxy.ts:395`), the partial
   chunks already shipped to the client are not retracted; the refactor
   to `handler-streaming.ts` must preserve this exact behavior. A test
   asserting "N chunks delivered before block, 0 after" would lock it
   in.
4. **Header-rewriting edge cases.** `forwardHeaders` strips `Host` and
   `Content-Length` only; the GW-T2 threat model row notes the rest
   pass through. A regression test for each forwarded
   security-sensitive header (`Authorization`, `Cookie`, `X-API-Key`,
   `X-Forwarded-For`) would prevent an over-eager strip in the
   `headers.ts` move.

### Recommended refactor order (v0.2)

1. Add the four coverage gap tests above. PR 1.
2. Extract `routing.ts` and `headers.ts`. Smallest, cleanest moves. PR 2.
3. Extract `prompt-extraction.ts`. Pure functions, easy to verify. PR 3.
4. Extract `envelope.ts` (the 422 builder). Now there is exactly one
   source of truth for the documented exception. PR 4.
5. Extract `handler-non-streaming.ts`. PR 5.
6. Extract `handler-streaming.ts`. PR 6.
7. Extract `handler-chat.ts` — pull the `app.all("/*")` body into named
   functions. PR 7.
8. Rename `proxy.ts` to `proxy/index.ts`; the only consumer is
   `packages/gateway/src/index.ts`. PR 8.

### v0.2 sizing estimate

~410 LOC moved across 8 new files. **High risk** because the
`app.all("/*")` body is the request/response branching brain of the
gateway. The nine existing test files are the protective harness; the
four coverage gap tests close the remaining branches.

---

## Out of scope

- Renaming any public exports (`checkCommand`, `createProxy`,
  `renderPrMarkdown`, the dashboard fetchers).
- Changing observable behavior of any of the three files.
- Reducing total LOC. The refactor is structural; line count may go up
  slightly due to per-file headers and re-export indices.
- Re-architecting the gateway streaming model (separate v0.2 ticket,
  AMP91-GW-003 streaming bounds).
- Adding new formatters to `check.ts` (separate v0.2 ticket per format
  request).

## v0.2 sequencing

These three refactors are **independent of each other** and can land in
any order. Recommended order based on risk ascending:

1. `apps/web/lib/dashboard-data.ts` (Low risk).
2. `packages/cli/src/commands/check.ts` (Medium risk).
3. `packages/gateway/src/proxy.ts` (High risk).

Each refactor lands behind its own coverage-gap-tests PR first. No PR
merges until the new tests pass against the **unmodified** target file.
