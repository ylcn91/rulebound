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

## What this gate is NOT

- It is not the substitute for code review.
- It is not a performance / load test gate.
- It does not validate provider contracts for the gateway under live API
  drift. That is the job of separate provider smoke tests.

Use this gate immediately before tagging a release. If any stage fails,
record the owner and the phase from `amp-new.md` and resolve before
shipping.
