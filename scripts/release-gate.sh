#!/usr/bin/env bash
#
# Release gate for Rulebound. Runs the canonical sequence of checks the AMP-91
# master plan defines as required before declaring a release ready. Records
# pass/fail/skip per stage and exits non-zero if any required stage fails.
#
# Stage list (lead-decisions §2.2):
#   1.  install                 Team A
#   2.  lint                    Team A
#   3.  core-tests              Team A
#   4.  core-build              Team A
#   5.  web-build               Team A             --skip-web
#   6.  smoke:cli               Team A
#   7.  self-check              Team A
#   8.  docs-drift              Team A (DOC-002)   --skip-docs-drift
#   9.  secret-scan             Team A skeleton; Team C tool wiring (SEC-001)
#  10.  artefact-hygiene        Team A
#  11.  tracked-artefact-check  Team A
#  12.  sdk-parity              Team A (opt)        --skip-sdks (default skip per CI-001)
#
# Usage:
#   bash scripts/release-gate.sh [flags]
#
# Flags:
#   --skip-install         Skip stage 1 (assumes deps already installed).
#   --skip-sdks            Skip stage 12 (sdk-parity); SKIP record emitted.
#   --skip-dotnet          Propagate to test-sdks.sh / build-sdks.sh.
#   --skip-web             Skip stage 5 (web-build); SKIP record emitted.
#   --skip-docs-drift      Skip stage 8 (docs-drift); SKIP record emitted.
#   --include-sdks         Run stage 12 even if --skip-sdks is the default.
#   --json                 Emit machine-readable JSON summary to stdout;
#                          human progress logs route to stderr.
#
# Exit codes:
#   0 — all required stages PASS (skipped stages do not count as failures).
#   1 — at least one required stage FAILED.
#   2 — unknown flag.

set -uo pipefail

cd "$(dirname "$0")/.."

SKIP_INSTALL=0
SKIP_SDKS=0
SKIP_DOTNET=0
SKIP_WEB=0
SKIP_DOCS_DRIFT=0
INCLUDE_SDKS=0
JSON_OUTPUT=0
for arg in "$@"; do
  case "$arg" in
    --skip-install)    SKIP_INSTALL=1 ;;
    --skip-sdks)       SKIP_SDKS=1 ;;
    --skip-dotnet)     SKIP_DOTNET=1 ;;
    --skip-web)        SKIP_WEB=1 ;;
    --skip-docs-drift) SKIP_DOCS_DRIFT=1 ;;
    --include-sdks)    INCLUDE_SDKS=1 ;;
    --json)            JSON_OUTPUT=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done
export SKIP_DOTNET

# When --json is set, all human progress logs go to stderr so stdout stays a
# clean JSON document. Stage commands have their stdout redirected to stderr
# (via the run_stage helper) so analyzer/tool output does not pollute the
# JSON payload.
if [ "$JSON_OUTPUT" -eq 1 ]; then
  log() { echo "$@" >&2; }
else
  log() { echo "$@"; }
fi

declare -a STAGE_NAMES STAGE_RESULTS STAGE_NOTES STAGE_DURATIONS STAGE_EXIT_CODES
overall_status=0

record() {
  # record <name> <status: pass|fail|skip> <exit_code> <duration_ms> <note>
  local name="$1" status="$2" code="$3" duration_ms="$4" note="$5"
  STAGE_NAMES+=("$name")
  STAGE_RESULTS+=("$status")
  STAGE_EXIT_CODES+=("$code")
  STAGE_DURATIONS+=("$duration_ms")
  STAGE_NOTES+=("$note")
  if [ "$status" = "fail" ]; then
    overall_status=1
  fi
}

run_stage() {
  local name="$1"; shift
  log
  log "=========================================="
  log " STAGE: $name"
  log "=========================================="
  local start_s=$SECONDS
  local rc=0
  if [ "$JSON_OUTPUT" -eq 1 ]; then
    "$@" >&2 || rc=$?
  else
    "$@" || rc=$?
  fi
  local elapsed=$(( SECONDS - start_s ))
  if [ "$rc" -eq 0 ]; then
    record "$name" "pass" 0 $(( elapsed * 1000 )) "${elapsed}s"
  else
    record "$name" "fail" "$rc" $(( elapsed * 1000 )) "exit=$rc, ${elapsed}s"
  fi
}

skip_stage() {
  local name="$1" reason="$2"
  log
  log "=========================================="
  log " STAGE: $name (skipped)"
  log " reason: $reason"
  log "=========================================="
  record "$name" "skip" 0 0 "skipped: $reason"
}

# -----------------------------------------------------------------------------
# Stage 1: install
# -----------------------------------------------------------------------------
if [ "$SKIP_INSTALL" -eq 1 ]; then
  skip_stage "install" "--skip-install"
else
  run_stage "install" pnpm install --frozen-lockfile
fi

# -----------------------------------------------------------------------------
# Stage 2: lint
# -----------------------------------------------------------------------------
run_stage "lint" pnpm lint

# -----------------------------------------------------------------------------
# Stage 3: core-tests (TS workspaces and apps; native SDKs gated separately)
# -----------------------------------------------------------------------------
core_tests() {
  pnpm -r --filter './packages/**' --filter './apps/**' test
}
run_stage "core-tests" core_tests

# -----------------------------------------------------------------------------
# Stage 4: core-build (TS workspaces and apps; native SDKs gated separately)
# -----------------------------------------------------------------------------
core_build() {
  pnpm -r --filter './packages/**' --filter './apps/**' build
}
run_stage "core-build" core_build

# -----------------------------------------------------------------------------
# Stage 5: web-build
# -----------------------------------------------------------------------------
if [ "$SKIP_WEB" -eq 1 ]; then
  skip_stage "web-build" "--skip-web"
else
  run_stage "web-build" pnpm --filter @rulebound/web build
fi

# -----------------------------------------------------------------------------
# Stage 6: smoke:cli (packed CLI installability + quickstart smoke)
# -----------------------------------------------------------------------------
smoke_cli() {
  if pnpm run | grep -q "^  smoke:cli"; then
    pnpm smoke:cli
  else
    bash scripts/smoke-test-cli.sh
  fi
}
run_stage "smoke:cli" smoke_cli

# -----------------------------------------------------------------------------
# Stage 7: self-check (Rulebound dogfood deterministic gate)
# -----------------------------------------------------------------------------
run_stage "self-check" node packages/cli/dist/index.js check --format github --base main

# -----------------------------------------------------------------------------
# Stage 8: docs-drift (DOC-002)
# -----------------------------------------------------------------------------
if [ "$SKIP_DOCS_DRIFT" -eq 1 ]; then
  skip_stage "docs-drift" "--skip-docs-drift"
else
  run_stage "docs-drift" bash scripts/check-docs-drift.sh
fi

# -----------------------------------------------------------------------------
# Stage 9: secret-scan (skeleton — Team C SEC-001 plugs the tool wiring).
# Behavior contract: if scripts/secret-scan.sh exists, invoke it; otherwise
# emit a SKIP with an explicit note pointing at the owning task. This stage
# must NOT FAIL silently — when the tool is shipped, the script's exit code
# becomes the stage's exit code.
# -----------------------------------------------------------------------------
secret_scan() {
  if [ -f scripts/secret-scan.sh ]; then
    bash scripts/secret-scan.sh
  else
    return 99
  fi
}
secret_scan_stage() {
  log
  log "=========================================="
  log " STAGE: secret-scan"
  log "=========================================="
  if [ ! -f scripts/secret-scan.sh ]; then
    log " note: scripts/secret-scan.sh not present"
    log " AMP91-SEC-001 not yet shipped — Team C Wave 2."
    record "secret-scan" "skip" 0 0 "scripts/secret-scan.sh missing — AMP91-SEC-001 (Team C Wave 2)"
    return
  fi
  local start_s=$SECONDS
  local rc=0
  if [ "$JSON_OUTPUT" -eq 1 ]; then
    bash scripts/secret-scan.sh >&2 || rc=$?
  else
    bash scripts/secret-scan.sh || rc=$?
  fi
  local elapsed=$(( SECONDS - start_s ))
  if [ "$rc" -eq 0 ]; then
    record "secret-scan" "pass" 0 $(( elapsed * 1000 )) "${elapsed}s"
  else
    record "secret-scan" "fail" "$rc" $(( elapsed * 1000 )) "exit=$rc, ${elapsed}s"
  fi
}
secret_scan_stage

# -----------------------------------------------------------------------------
# Stage 10: artefact-hygiene — fail if build outputs / agent caches leaked
# past .gitignore.
# -----------------------------------------------------------------------------
artefact_hygiene() {
  local stray
  stray=$(git ls-files --others --exclude-standard \
    | grep -E '(^sdks/.+/(target|bin|obj|dist|build)/|\.tsbuildinfo$|(^|/)\.claude/|(^|/)\.next/|(^|/)\.venv/|(^|/)__pycache__/|\.egg-info(/|$))' || true)
  if [ -n "$stray" ]; then
    log "Stray build artefacts present (extend .gitignore or clean before release):"
    log "$stray"
    return 1
  fi
  return 0
}
run_stage "artefact-hygiene" artefact_hygiene

# -----------------------------------------------------------------------------
# Stage 11: tracked-artefact-check — fail if generated files are tracked in git.
# -----------------------------------------------------------------------------
tracked_artefact_check() {
  local tracked
  tracked=$(git ls-files \
    | grep -E '(\.tsbuildinfo$|\.pyc$|(^|/)node_modules/|(^|/)\.next/|(^|/)__pycache__/|\.egg-info(/|$)|^sdks/.+/(target|bin|obj|dist|build)/)' || true)
  if [ -n "$tracked" ]; then
    log 'Generated artefacts tracked in git (move to .gitignore and `git rm --cached`):'
    log "$tracked"
    return 1
  fi
  return 0
}
run_stage "tracked-artefact-check" tracked_artefact_check

# -----------------------------------------------------------------------------
# Stage 12: sdk-parity (opt-in by default per CI-001 lead decision).
# Default: SKIP (--skip-sdks behavior). Use --include-sdks to force a run.
# -----------------------------------------------------------------------------
sdk_parity_should_run() {
  # Default skip; --include-sdks forces run; --skip-sdks always skips.
  if [ "$SKIP_SDKS" -eq 1 ]; then
    return 1
  fi
  if [ "$INCLUDE_SDKS" -eq 1 ]; then
    return 0
  fi
  return 1
}
if sdk_parity_should_run; then
  run_stage "sdk-parity" bash scripts/test-sdks.sh
else
  if [ "$SKIP_SDKS" -eq 1 ]; then
    skip_stage "sdk-parity" "--skip-sdks"
  else
    skip_stage "sdk-parity" "default skip (use --include-sdks to run)"
  fi
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
if [ "$JSON_OUTPUT" -eq 1 ]; then
  # Emit JSON to stdout. Use node to encode safely (notes may contain commas,
  # quotes, or shell metacharacters).
  json_input=""
  for i in "${!STAGE_NAMES[@]}"; do
    json_input+="${STAGE_NAMES[$i]}\t${STAGE_RESULTS[$i]}\t${STAGE_EXIT_CODES[$i]}\t${STAGE_DURATIONS[$i]}\t${STAGE_NOTES[$i]}\n"
  done
  overall_label="pass"
  if [ "$overall_status" -ne 0 ]; then overall_label="fail"; fi
  RB_OVERALL="$overall_label" printf "%b" "$json_input" | RB_OVERALL="$overall_label" node -e '
    let raw = "";
    process.stdin.on("data", (c) => { raw += c; });
    process.stdin.on("end", () => {
      const overall = process.env.RB_OVERALL || "pass";
      const lines = raw.split("\n").filter((l) => l.length > 0);
      const stages = lines.map((line) => {
        const [name, status, exitCode, durationMs, ...rest] = line.split("\t");
        const note = rest.join("\t");
        const stage = {
          name,
          status,
          durationMs: parseInt(durationMs, 10) || 0,
          exitCode: parseInt(exitCode, 10) || 0,
        };
        if (note && note.length > 0) stage.note = note;
        return stage;
      });
      const doc = { overall, stages };
      process.stdout.write(JSON.stringify(doc, null, 2) + "\n");
    });
  '
fi

log
log "=========================================="
log " RELEASE GATE SUMMARY"
log "=========================================="
{
  printf "%-30s %-10s %s\n" "STAGE" "STATUS" "NOTE"
  for i in "${!STAGE_NAMES[@]}"; do
    name="${STAGE_NAMES[$i]}"
    status="${STAGE_RESULTS[$i]}"
    note="${STAGE_NOTES[$i]}"
    case "$status" in
      pass) label="PASS" ;;
      skip) label="SKIP" ;;
      fail) label="FAIL" ;;
      *)    label="UNKNOWN" ;;
    esac
    printf "%-30s %-10s %s\n" "$name" "$label" "$note"
  done
} >&2

log
if [ "$overall_status" -eq 0 ]; then
  log "Release gate: GREEN"
else
  log "Release gate: RED — see failing stages above"
fi
exit "$overall_status"
