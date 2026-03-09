# Project Analysis and Next Steps

Date: 2026-03-09

## Executive Summary

Rulebound is now in a much stronger state than the original repository snapshot:

- `pnpm test` passes
- `pnpm build` passes
- server, CLI, gateway, MCP, LSP, web, and most SDK surfaces were exercised
- live smoke tests validated the main dashboard and API flows

That said, the repository is **not yet release-clean**. The code works in the current workspace, but there are still structural issues that will slow development, increase deployment risk, and make future regressions more likely unless they are addressed deliberately.

The biggest remaining concerns are:

1. **Database changes are not migration-backed**
2. **The repository is polluted by test/runtime artifacts**
3. **Core data/contracts are duplicated in multiple places**
4. **Validation against real external LLM providers has not been completed**
5. **Some packaging and installability behaviors still depend on the repo layout**

## What Was Verified

The current analysis is based on:

- automatic test and build runs
- live API smoke tests against the local server
- live dashboard smoke tests through the web UI
- live gateway smoke tests with a fake upstream LLM
- live MCP runtime calls over stdio
- live LSP initialize handshake over stdio
- CLI smoke tests in an isolated temporary git repo

Related artifacts:

- [API smoke request/response log](./API_SMOKE_REQUEST_RESPONSES.md)
- [Existing QA plan](./QA-TEST-PLAN.md)
- [Architecture doc](./ARCHITECTURE.md)

## Current Strengths

- The monorepo now has working build/test gates across the main packages.
- The server has a coherent authenticated API surface for rules, projects, validation, compliance, audit, tokens, analytics, and webhooks.
- The web app now behaves like a true client of the backend instead of maintaining separate business logic.
- CLI telemetry and staged diff handling are materially better than before.
- Gateway enforcement now behaves meaningfully in `moderate` mode and supports OpenAI/Gemini-shaped requests.
- MCP and LSP both work as real runtime processes, not just unit-test targets.
- SDK coverage is much broader than before, and CI wiring was added for parity.

## Findings

### Critical

#### 1. Database schema evolution is not reproducible

The current server code expects the new schema, but the local smoke environment required **manual SQL fixes** before key features could work. The most visible example was `webhook_endpoints`, where the running code expected `encrypted_secret` and `secret_hash`, while the local database still had the old `secret` shape.

Evidence:

- [packages/server/src/db/schema.ts](/Users/yalcindoksanbir/rulebound/packages/server/src/db/schema.ts)
- no migration folders were found in the repository root or package structure during analysis

Impact:

- deploys are not reproducible from source alone
- green tests do not guarantee green production/startup environments
- local developer setup can silently diverge from code expectations

Required follow-up:

- add versioned migrations for all schema changes already encoded in the Drizzle schema
- document a single bootstrap path for DB setup
- stop relying on manual psql patching during smoke testing

#### 2. The workspace is polluted by runtime/test artifacts

The repository currently accumulates artifacts from validation, Playwright, SDK builds, and manual smoke work:

- `.playwright-cli/`
- `.rulebound/`
- `packages/gateway/.rulebound/stats.json`
- `packages/mcp/.rulebound/stats.json`
- `sdks/python/rulebound.egg-info/`
- `sdks/python/__pycache__/`
- `.DS_Store` files in multiple directories

Evidence:

- current `git status` output
- local artifact directories created during smoke work and test commands

Impact:

- harder code review and release prep
- accidental commits of machine-specific state
- false confidence because “green repo” may depend on local residue

Required follow-up:

- add/expand `.gitignore`
- redirect test/runtime outputs into dedicated ignored artifact folders
- ensure telemetry in tests writes to temp locations, not repo paths

#### 3. Domain contracts are duplicated

There are still multiple copies of the same domain ideas:

- web-side DB schema and DB client remain in [apps/web/lib/db/schema.ts](/Users/yalcindoksanbir/rulebound/apps/web/lib/db/schema.ts) and [apps/web/lib/db/index.ts](/Users/yalcindoksanbir/rulebound/apps/web/lib/db/index.ts)
- server-side DB schema lives in [packages/server/src/db/schema.ts](/Users/yalcindoksanbir/rulebound/packages/server/src/db/schema.ts)
- project resolution logic exists in both [packages/server/src/lib/access.ts](/Users/yalcindoksanbir/rulebound/packages/server/src/lib/access.ts) and [packages/server/src/lib/projects.ts](/Users/yalcindoksanbir/rulebound/packages/server/src/lib/projects.ts)

Impact:

- future behavior drift is very likely
- bug fixes must be repeated in multiple places
- ownership boundaries become blurry

Required follow-up:

- keep only one canonical server schema
- delete unused web DB access if the web app is now API-first
- consolidate project/org access helpers into one module

### High Priority

#### 4. Dashboard auth model is functional but not product-complete

The dashboard currently depends on service credentials in environment variables:

- `RULEBOUND_API_URL`
- `RULEBOUND_API_TOKEN`

Evidence:

- [apps/web/lib/api.ts](/Users/yalcindoksanbir/rulebound/apps/web/lib/api.ts)

This is acceptable for internal smoke and admin-style use, but it is not equivalent to end-user authentication.

Impact:

- no true per-user browser session model
- browser UX is tightly coupled to backend service-token setup
- difficult to evolve into a real multi-user SaaS experience

Required follow-up:

- decide whether Rulebound remains operator/internal-first or moves to real user auth
- if user auth is desired, define session model, org selection, and permission boundaries

#### 5. `rulebound init --examples` is not reliably installable outside the repo

`findExamplesDir()` searches for `examples/rules` by walking upward from the current working directory.

Evidence:

- [packages/cli/src/commands/init.ts](/Users/yalcindoksanbir/rulebound/packages/cli/src/commands/init.ts)

This works inside the Rulebound repo, but is fragile for external users running an installed CLI in unrelated repositories.

Impact:

- the feature behaves differently depending on where the CLI is invoked
- external dogfooding can silently fall back to the starter rule instead of real examples

Required follow-up:

- package example rules with the CLI distribution
- resolve examples relative to the installed package, not the target repo

#### 6. Root native SDK build/test scripts are convenient but not hermetic

The root scripts now run native SDK checks, but they:

- create local venv/build artifacts
- skip `.NET` if the toolchain is missing
- therefore allow a local machine to report green while not executing every SDK equally

Evidence:

- [scripts/build-sdks.sh](/Users/yalcindoksanbir/rulebound/scripts/build-sdks.sh)
- [scripts/test-sdks.sh](/Users/yalcindoksanbir/rulebound/scripts/test-sdks.sh)

Impact:

- local “all green” is weaker than CI “all green”
- generated artifacts pollute the repo unless explicitly cleaned

Required follow-up:

- keep local skip behavior, but document that CI is the strict source of truth
- write artifacts to ignored temp/build folders consistently
- add a cleanup step or dedicated dev helper

#### 7. Real external LLM validation is still missing

Gateway logic was verified with a fake upstream, not a live provider.

Reason:

- no `OPENAI_API_KEY`
- no `ANTHROPIC_API_KEY`
- no `GOOGLE_API_KEY` / `GEMINI_API_KEY`

Impact:

- real provider request/response quirks are still a risk
- streaming behavior, auth header forwarding, and model-specific edge cases remain partially unproven

Required follow-up:

- run a dedicated staging smoke suite against a real provider
- capture real transcripts and expected enforcement outputs

### Medium Priority

#### 8. Web test strategy is fragmented

The web package mixes:

- Node-based transform test scripts
- Vitest-based focused tests
- dashboard-data and API helper tests in a bespoke arrangement

Evidence:

- [apps/web/package.json](/Users/yalcindoksanbir/rulebound/apps/web/package.json)

Impact:

- the suite is harder to reason about than the other packages
- small test-runner/config changes can easily break one layer while another stays green

Required follow-up:

- unify web test execution behind one clearly owned strategy
- document what is unit, what is smoke, what is CSS consistency checking

#### 9. Documentation drift already exists

The QA doc still reflects old package counts and outdated suite descriptions.

Evidence:

- [docs/QA-TEST-PLAN.md](/Users/yalcindoksanbir/rulebound/docs/QA-TEST-PLAN.md)

Impact:

- contributors will trust stale instructions
- manual QA becomes inconsistent with the actual repository

Required follow-up:

- refresh QA and setup docs after the current stabilization work is committed

#### 10. Minor local-dev rough edges remain

Examples:

- favicon 404 in browser console during page loads
- developer-specific fallback DB string in web DB helper: [apps/web/lib/db/index.ts](/Users/yalcindoksanbir/rulebound/apps/web/lib/db/index.ts)
- static dashboard strings such as “My Organization”

These are not blockers, but they contribute to a rougher developer and demo experience.

## Recommended Work Plan

### Phase 1: Release Hygiene

Goal: make the current green state commit-ready and reproducible.

Tasks:

- clean up repo artifacts and update `.gitignore`
- remove accidental `.rulebound/`, `.playwright-cli/`, `.egg-info/`, `__pycache__/`, and `.DS_Store` noise from tracked workflows
- ensure intended source files are committed and only intended source files

Success criteria:

- `git status` is clean except for intentional feature work
- local test/build artifacts no longer appear as repo changes

### Phase 2: Migration and Schema Discipline

Goal: remove manual DB drift risk.

Tasks:

- create proper migrations for current schema
- document how to bootstrap and migrate local databases
- verify that a fresh database can be brought to the current shape without ad hoc SQL

Success criteria:

- new developer can set up DB from repo only
- smoke tests work on a fresh DB after documented setup

### Phase 3: Contract Consolidation

Goal: reduce future drift.

Tasks:

- consolidate project/org access logic into one helper layer
- remove or deprecate duplicated schema definitions on the web side
- move any remaining shared contract types into one intentionally owned place

Success criteria:

- one canonical schema source
- one canonical project resolution implementation

### Phase 4: Productization Decisions

Goal: decide which “temporary but working” behaviors are actually product policy.

Tasks:

- decide whether dashboard auth stays service-token based or becomes user-session based
- decide whether CLI example rules should ship in the package
- define what “supported local environment” means for SDK toolchains

Success criteria:

- these areas are documented as product decisions, not incidental implementation details

### Phase 5: Real-Provider Validation

Goal: close the gap between fake-upstream confidence and real LLM confidence.

Tasks:

- run gateway smoke tests against a real OpenAI, Anthropic, or Gemini account
- capture request/response examples for non-streaming and streaming enforcement
- verify auth forwarding, prompt injection, violation blocking, and warning append behavior with real upstream responses

Success criteria:

- one committed test report from a real provider
- no remaining ambiguity about provider-level compatibility

### Phase 6: Documentation Refresh

Goal: align docs with reality.

Tasks:

- update `docs/QA-TEST-PLAN.md`
- document the service-token dashboard setup
- document DB migration/bootstrap steps
- document the current limits of local vs CI SDK verification

Success criteria:

- docs reflect current package layout, commands, and validation scope

## Suggested Ownership

- **Server + DB discipline**: backend owner
- **Web cleanup + contract consolidation**: full-stack owner
- **CLI packaging/installability**: tooling owner
- **Gateway real-provider validation**: infra/tooling owner
- **SDK and CI truth model**: platform owner

## Bottom Line

Rulebound is now in a solid working state, but the next engineering win is not “more features.” It is making the current success:

- reproducible
- clean
- contract-stable
- migration-safe
- and validated against real upstream LLMs

That is the shortest path from “working in this workspace” to “safe to ship and maintain.”
