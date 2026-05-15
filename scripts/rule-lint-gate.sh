#!/usr/bin/env bash
# rule-lint-gate.sh — fail when bundled example rules score below threshold.
#
# Runs `rulebound rules lint --format json` against the CLI's bundled example
# rules and exits non-zero if the average score is below RB_LINT_THRESHOLD.
#
# Usage:
#   bash scripts/rule-lint-gate.sh
#   RB_LINT_THRESHOLD=80 bash scripts/rule-lint-gate.sh
#   bash scripts/rule-lint-gate.sh --dir path/to/rules        # override rules dir
#   bash scripts/rule-lint-gate.sh --threshold 80             # override threshold
#
# Wave 3 starts at 70; release-gate.sh stage wiring lands in Team A Wave 4
# CI-003.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_DIST="${REPO_ROOT}/packages/cli/dist/index.js"
RULES_DIR_DEFAULT="${REPO_ROOT}/packages/cli/rules/examples"

RULES_DIR=""
THRESHOLD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)
      RULES_DIR="${2:?--dir requires a path}"
      shift 2
      ;;
    --threshold)
      THRESHOLD="${2:?--threshold requires a number}"
      shift 2
      ;;
    -h|--help)
      grep '^#' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      printf '[rule-lint-gate][FAIL] unknown argument: %s\n' "$1" >&2
      exit 2
      ;;
  esac
done

RULES_DIR="${RULES_DIR:-${RULES_DIR_DEFAULT}}"
THRESHOLD="${THRESHOLD:-${RB_LINT_THRESHOLD:-70}}"

log() { printf '[rule-lint-gate] %s\n' "$*"; }
fail() { printf '[rule-lint-gate][FAIL] %s\n' "$*" >&2; exit 1; }

if [[ ! -d "${RULES_DIR}" ]]; then
  fail "rules directory not found: ${RULES_DIR}"
fi

if [[ ! -f "${CLI_DIST}" ]]; then
  log "building @rulebound/cli (dist not found)"
  pnpm --filter @rulebound/cli build >/dev/null
fi

if [[ ! -f "${CLI_DIST}" ]]; then
  fail "CLI dist still missing after build: ${CLI_DIST}"
fi

log "lint dir: ${RULES_DIR}"
log "threshold: ${THRESHOLD}"

LINT_JSON="$(node "${CLI_DIST}" rules lint --format json --dir "${RULES_DIR}")"
if [[ -z "${LINT_JSON}" ]]; then
  fail "rulebound rules lint emitted no output"
fi

# parse averageScore + ruleCount via node to avoid jq dependency.
SCORE="$(node -e '
const j = JSON.parse(process.argv[1]);
if (j.error) { process.stderr.write(`lint error: ${j.error}\n`); process.exit(2); }
if (typeof j.averageScore !== "number") { process.stderr.write("averageScore missing\n"); process.exit(2); }
process.stdout.write(String(j.averageScore));
' "${LINT_JSON}")"

COUNT="$(node -e '
const j = JSON.parse(process.argv[1]);
process.stdout.write(String(j.ruleCount ?? 0));
' "${LINT_JSON}")"

log "ruleCount: ${COUNT}"
log "averageScore: ${SCORE}"

if [[ "${COUNT}" -eq 0 ]]; then
  fail "no rules linted in ${RULES_DIR}"
fi

if (( SCORE < THRESHOLD )); then
  fail "rule lint score ${SCORE} is below threshold ${THRESHOLD}"
fi

log "PASS — score ${SCORE} ≥ threshold ${THRESHOLD}"
