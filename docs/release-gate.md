# Release Gate

The release gate is the canonical check sequence that must pass before a
release candidate is declared ready. It mirrors the steps from
`amp-new.md` Phase 8 and is wired as a single command.

## Run it

```bash
pnpm release:gate
# or, skipping the native SDK parity stage for a TS-only release run:
bash scripts/release-gate.sh --skip-sdks
# or, skipping the install step if you already ran it:
bash scripts/release-gate.sh --skip-install
# or, skipping just the .NET SDK toolchain (Python/Go/Java/Rust still run):
bash scripts/release-gate.sh --skip-dotnet
```

## Stages

| Stage                  | What it does                                                       | Exit code on failure |
|------------------------|--------------------------------------------------------------------|----------------------|
| install                | `pnpm install --frozen-lockfile`                                   | non-zero             |
| lint                   | `pnpm lint`                                                        | non-zero             |
| test                   | `pnpm test` (TS packages + apps; native SDKs run only in sdk-parity) | non-zero           |
| build                  | `pnpm build` (TS packages + apps; native SDKs run only in sdk-parity) | non-zero          |
| smoke:cli              | Packs and installs the CLI in a temp dir, runs doctor/check         | non-zero            |
| self-check             | `rulebound check --format github --base main`                       | 1 if violations     |
| artefact-hygiene       | Fails on stray build / cache outputs (`.claude/`, `.next/`, `.venv/`, `__pycache__`, `.egg-info`, SDK build dirs, `*.tsbuildinfo`) | non-zero |
| tracked-artefact-check | Fails if any generated artefact is tracked in git                   | non-zero            |
| sdk-parity             | `bash scripts/test-sdks.sh` — native SDK build/test                 | non-zero (skippable with `--skip-sdks`) |

A stage that exits with code 99 is treated as skipped (e.g. `--skip-sdks`).
The final summary prints PASS/FAIL/SKIP per stage and the script exits
non-zero if any required stage failed.

## Native SDK toolchain policy

Native SDK tests run only in the `sdk-parity` stage (and the separate
`SDK Parity` GitHub workflow). Root `pnpm test` / `pnpm build` no longer
shell into `scripts/test-sdks.sh` or `scripts/build-sdks.sh` — that
removes the silent-skip risk where missing toolchains made core CI look
green. Run them explicitly:

```bash
pnpm test:sdks   # bash scripts/test-sdks.sh
pnpm build:sdks  # bash scripts/build-sdks.sh
```

If the toolchain for a native SDK is not installed, the release gate
fails the `sdk-parity` stage with an actionable message. Release notes
must record any SDK explicitly skipped via `--skip-sdks` or
`--skip-dotnet`. Silent skips are not allowed.

### Known toolchain gap: .NET

`sdks/dotnet/Rulebound.csproj` targets `net8.0`. The release gate environment
must therefore provide a .NET SDK that can target .NET 8 (e.g. `dotnet@8` or
`dotnet@9`). If only `dotnet@6` is on `PATH`, `scripts/test-sdks.sh` and
`scripts/build-sdks.sh` now fail fast with:

```
FAIL: dotnet <major> < 8 (NETSDK1045 risk). Install .NET 8/9 or pass --skip-dotnet.
```

Three acceptable options:

1. Install a .NET 8/9 SDK and re-run the gate.
2. Run with `bash scripts/release-gate.sh --skip-dotnet` — Python/Go/Java/Rust
   still run; only the .NET stage is skipped. Record the .NET SDK as
   explicitly skipped in the release notes.
3. Run with `bash scripts/release-gate.sh --skip-sdks` — all native SDKs
   skipped. Use only when the release explicitly scopes SDK parity out.

## Server Postgres integration suite (Docker required)

Beyond the core release gate, the server ships a real-Postgres integration
test suite at `packages/server/src/__tests__/integration/**` that boots
Postgres 17 inside a testcontainer per run. This is **not** part of the
default `pnpm test` invocation — opt in explicitly:

```bash
pnpm --filter @rulebound/server test:integration
```

Requirements:

- A running Docker daemon (the test bootstraps `postgres:17` from
  `@testcontainers/postgresql`).
- The migrations under `packages/server/migrations/` (they are applied to
  the ephemeral database before suites run).

CI environments wire this as a separate job (the Docker-out-of-Docker or
sidecar container model) so a missing Docker daemon never silently skips
real-DB coverage. The job is required for the **full platform** release
checklist; it is not required for the core (CLI + engine + MCP + CI) gate.

If Docker is not available locally, `pnpm --filter @rulebound/server test`
(without `:integration`) runs only the unit suite and still exercises every
business-logic path through dependency injection. Use the integration suite
to catch SQL / Drizzle / migration drift, not as the primary correctness
proof.

## AMP-91 production readiness checklist

This runbook is the operational entry point. The canonical readiness
checklist lives in [`docs/amp-91-new.md` §9](./amp-91-new.md#9-production-launch-checklist),
and the per-gate scope (core vs full platform) is defined in
[§8 verification matrix](./amp-91-new.md#8-verification-matrix). Do not
duplicate that list — update §9 first, then mirror the deltas here.

Release scope must be decided before tagging. Pick one:

### Core release checklist (CLI + engine + MCP + CI)

The release-gate stages below are **all mandatory** for a core release.
A red stage blocks the tag.

- [ ] `pnpm release:gate` PASS (covers install, lint, test, build,
  smoke:cli, self-check, artefact-hygiene, tracked-artefact-check).
- [ ] `pnpm run check:rulebound` PASS (self-dogfood; also runs as the
  `self-check` stage above but record it explicitly in release notes).
- [ ] MCP parity tests PASS.
- [ ] Docs drift check PASS (`scripts/check-docs-drift.sh`).
- [ ] Secret scan PASS (`scripts/secret-scan.sh`, gitleaks; release-gate
  stage 9 — silent skip is not allowed).
- [ ] Dependency scan reviewed (`.github/workflows/dependency-scan.yml`;
  required-for-full, recommended-for-core per §8).
- [ ] GitHub Action examples validated (`scripts/smoke-action.sh`).
- [ ] README quickstart smoke PASS.
- [ ] Release notes state stable vs preview surfaces (core stable;
  server / gateway / dashboard / native SDKs preview unless promoted).
- [ ] Known limitations documented.

Stages explicitly **not required** for a core-only release:

- `sdk-parity` may be skipped with `--skip-sdks` (or `--skip-dotnet`),
  but every skipped SDK must be recorded in the release notes.
- Server real-Postgres integration suite is full-platform-only.
- Dashboard e2e and gateway provider contract tests are
  full-platform-only.

### Full platform release checklist (adds server / gateway / dashboard / SDKs)

Run after the core checklist is green. These gates are
**required for full** per §8; skipping any one of them downgrades the
release to core scope.

- [ ] Core release checklist complete.
- [ ] Server migrations committed and tested (no drift —
  `scripts/check-migration-drift.sh`).
- [ ] Server auth scopes enforced.
- [ ] CORS allowlist configured.
- [ ] Rate limiting documented or implemented.
- [ ] Server real-Postgres integration suite PASS
  (`pnpm --filter @rulebound/server test:integration`, Docker required).
- [ ] Web build PASS (`@rulebound/web build`).
- [ ] Dashboard e2e PASS (Playwright or equivalent).
- [ ] Gateway provider contract tests PASS.
- [ ] Gateway privacy / logging tests PASS.
- [ ] Native SDK parity PASS (`pnpm test:sdks` / `sdk-parity` stage
  without `--skip-sdks`) — or explicitly scoped out in release notes
  with each skipped SDK listed.
- [ ] Threat model docs complete (`docs/threat-model/`).
- [ ] Runbooks complete (`docs/runbooks/`).
- [ ] Rollback plan complete (`docs/runbooks/rollback.md`).
- [ ] Secret rotation procedure complete.

When a stage's status differs between core and full scope, refer back
to the §8 matrix as the source of truth.

## What this gate is NOT

- It is not the substitute for code review.
- It is not a performance / load test gate.
- It does not validate provider contracts for the gateway under live API
  drift. That is the job of separate provider smoke tests.

Use this gate immediately before tagging a release. If any stage fails,
record the owner and the phase from `amp-new.md` and resolve before
shipping.
