#!/usr/bin/env bash
#
# Release gate for Rulebound. Runs the same checks the plan defines as required
# before declaring a release ready. Records pass/fail per stage and exits
# non-zero if any required stage fails.
#
# Usage: bash scripts/release-gate.sh [--skip-install] [--skip-sdks]

set -uo pipefail

cd "$(dirname "$0")/.."

SKIP_INSTALL=0
SKIP_SDKS=0
for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-sdks)    SKIP_SDKS=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

declare -a STAGE_NAMES STAGE_RESULTS STAGE_NOTES
overall_status=0

record() {
  local name="$1" code="$2" note="$3"
  STAGE_NAMES+=("$name")
  STAGE_RESULTS+=("$code")
  STAGE_NOTES+=("$note")
  if [ "$code" -ne 0 ] && [ "$code" -ne 99 ]; then
    overall_status=1
  fi
}

run_stage() {
  local name="$1"; shift
  echo
  echo "=========================================="
  echo " STAGE: $name"
  echo "=========================================="
  local start=$SECONDS
  if "$@"; then
    local elapsed=$(( SECONDS - start ))
    record "$name" 0 "${elapsed}s"
  else
    local code=$?
    local elapsed=$(( SECONDS - start ))
    record "$name" "$code" "exit=$code, ${elapsed}s"
  fi
}

skip_stage() {
  local name="$1" reason="$2"
  echo
  echo "=========================================="
  echo " STAGE: $name (skipped)"
  echo " reason: $reason"
  echo "=========================================="
  record "$name" 99 "skipped: $reason"
}

# Stage 1: install
if [ "$SKIP_INSTALL" -eq 1 ]; then
  skip_stage "install" "--skip-install"
else
  run_stage "install" pnpm install --frozen-lockfile
fi

# Stage 2: lint
run_stage "lint" pnpm lint

# Stage 3: test (TS workspaces only — skip the rust/python/dotnet SDKs unless explicitly wanted)
if [ "$SKIP_SDKS" -eq 1 ]; then
  run_stage "test (ts)" pnpm -r --filter "./packages/**" test
else
  run_stage "test" pnpm test
fi

# Stage 4: build (TS workspaces, skip native SDK build by default)
if [ "$SKIP_SDKS" -eq 1 ]; then
  run_stage "build (ts)" pnpm -r --filter "./packages/**" build
else
  run_stage "build" pnpm build
fi

# Stage 5: smoke:cli (packed CLI installability)
if pnpm run | grep -q "^  smoke:cli"; then
  run_stage "smoke:cli" pnpm smoke:cli
else
  run_stage "smoke:cli" bash scripts/smoke-test-cli.sh
fi

# Stage 6: deterministic self-gate
run_stage "self-check" node packages/cli/dist/index.js check --format github --base main

# Stage 7: artefact hygiene — fail if SDK build outputs leaked past .gitignore.
artefact_hygiene() {
  local stray
  stray=$(git ls-files --others --exclude-standard \
    | grep -E '^(sdks/.+/(target|bin|obj|dist|build)/|.*\.tsbuildinfo$)' || true)
  if [ -n "$stray" ]; then
    echo "Stray build artefacts present (extend .gitignore or clean before release):" >&2
    echo "$stray" >&2
    return 1
  fi
  return 0
}
run_stage "artefact-hygiene" artefact_hygiene

# Summary
echo
echo "=========================================="
echo " RELEASE GATE SUMMARY"
echo "=========================================="
printf "%-30s %-10s %s\n" "STAGE" "STATUS" "NOTE"
for i in "${!STAGE_NAMES[@]}"; do
  name="${STAGE_NAMES[$i]}"
  code="${STAGE_RESULTS[$i]}"
  note="${STAGE_NOTES[$i]}"
  if [ "$code" -eq 0 ]; then
    status="PASS"
  elif [ "$code" -eq 99 ]; then
    status="SKIP"
  else
    status="FAIL"
  fi
  printf "%-30s %-10s %s\n" "$name" "$status" "$note"
done

echo
if [ "$overall_status" -eq 0 ]; then
  echo "Release gate: GREEN"
else
  echo "Release gate: RED — see failing stages above"
fi
exit "$overall_status"
