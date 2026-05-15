#!/usr/bin/env bash
# smoke-test-cli.sh — end-to-end packaging smoke test for @rulebound/cli.
#
# Steps:
#   1. Build @rulebound/cli (and its workspace deps via turbo).
#   2. pnpm pack inside packages/cli to produce a tarball.
#   3. Create a temp dir, npm init, install the tarball.
#   4. Run `rulebound init --examples --no-hook`, then `doctor`, then `check --format json`.
#   5. Inspect outputs. Exit non-zero on any failure.
#
# Usage: bash scripts/smoke-test-cli.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_DIR="${REPO_ROOT}/packages/cli"

log() { printf '\n[smoke-test] %s\n' "$*"; }
fail() { printf '\n[smoke-test][FAIL] %s\n' "$*" >&2; exit 1; }

cleanup() {
  local code=$?
  if [[ -n "${TMP_DIR:-}" && -d "${TMP_DIR}" ]]; then
    log "cleaning up ${TMP_DIR}"
    rm -rf "${TMP_DIR}"
  fi
  if [[ -n "${PACK_DEST:-}" && -d "${PACK_DEST}" ]]; then
    rm -rf "${PACK_DEST}"
  fi
  exit "${code}"
}
trap cleanup EXIT

command -v pnpm >/dev/null 2>&1 || fail "pnpm is required"
command -v npm  >/dev/null 2>&1 || fail "npm is required"
command -v node >/dev/null 2>&1 || fail "node is required"

log "building @rulebound/cli"
pnpm --filter @rulebound/cli... build >/dev/null

log "pnpm pack (cli + workspace deps)"
PACK_DEST="$(mktemp -d -t rulebound-pack.XXXXXX)"
pack_one() {
  local pkg_dir="$1"
  local tarball
  tarball="$(cd "${pkg_dir}" && pnpm pack --pack-destination "${PACK_DEST}" 2>/dev/null | tail -n1)"
  [[ -f "${tarball}" ]] || fail "pack failed for ${pkg_dir} (got: ${tarball})"
  printf '%s' "${tarball}"
}
SHARED_TARBALL="$(pack_one "${REPO_ROOT}/packages/shared")"
ENGINE_TARBALL="$(pack_one "${REPO_ROOT}/packages/engine")"
CLI_TARBALL="$(pack_one "${CLI_DIR}")"
log "tarballs:"
log "  shared: ${SHARED_TARBALL}"
log "  engine: ${ENGINE_TARBALL}"
log "  cli:    ${CLI_TARBALL}"

TMP_DIR="$(mktemp -d -t rulebound-smoke.XXXXXX)"
log "temp project: ${TMP_DIR}"

pushd "${TMP_DIR}" >/dev/null

log "npm init -y"
npm init -y >/dev/null

log "npm install (cli + workspace tarballs)"
# Install workspace deps first so npm can satisfy @rulebound/engine and @rulebound/shared
# from local tarballs instead of hitting the public registry.
npm install --no-save "${SHARED_TARBALL}" "${ENGINE_TARBALL}" "${CLI_TARBALL}" >/dev/null

# git init so doctor/check are happy with their git lookups
log "git init (for doctor)"
git init -q
git config user.email "smoke@rulebound.local"
git config user.name "smoke"

log "rulebound init --examples --no-hook"
npx --no-install rulebound init --examples --no-hook

if [[ ! -d ".rulebound/rules" ]]; then
  fail ".rulebound/rules was not created"
fi
rule_count="$(find .rulebound/rules -name '*.md' | wc -l | tr -d ' ')"
if [[ "${rule_count}" -lt 1 ]]; then
  fail "no example rules were copied"
fi
log "example rules copied: ${rule_count}"

log "rulebound doctor"
# doctor exits 0 on clean install — examples are copied, config is present.
npx --no-install rulebound doctor

log "rulebound check --format json"
# check may exit 1 if examples include violations against this temp dir.
# We only assert that the JSON output is well-formed and includes summary.
set +e
CHECK_OUT="$(npx --no-install rulebound check --format json)"
CHECK_CODE=$?
set -e

case "${CHECK_CODE}" in
  0|1)
    ;;
  *)
    fail "rulebound check exited with unexpected code ${CHECK_CODE}: ${CHECK_OUT}"
    ;;
esac

# minimal JSON shape assertion
if ! node -e "const r = JSON.parse(process.argv[1]); if (!r.summary || typeof r.summary.pass !== 'number') process.exit(1)" "${CHECK_OUT}"; then
  fail "rulebound check JSON did not include a valid summary"
fi
log "check JSON looks valid (exit ${CHECK_CODE})"

popd >/dev/null

RULEBOUND_BIN="${TMP_DIR}/node_modules/.bin/rulebound"
if [[ ! -x "${RULEBOUND_BIN}" ]]; then
  fail "rulebound bin not found at ${RULEBOUND_BIN}"
fi

log "rulebound init --pack starter --pack typescript --pack security (packs subdir)"
PACK_TMP="$(mktemp -d -t rulebound-smoke-pack.XXXXXX)"
pushd "${PACK_TMP}" >/dev/null
git init -q
git config user.email "smoke@rulebound.local"
git config user.name "smoke"
"${RULEBOUND_BIN}" init --pack starter --pack typescript --pack security --no-hook
if [[ ! -d ".rulebound/rules/starter" ]]; then
  fail "pack install did not create .rulebound/rules/starter"
fi
if [[ ! -d ".rulebound/rules/typescript" ]]; then
  fail "pack install did not create .rulebound/rules/typescript"
fi
if [[ ! -d ".rulebound/rules/security" ]]; then
  fail "pack install did not create .rulebound/rules/security"
fi
starter_files="$(find .rulebound/rules/starter -name '*.md' | wc -l | tr -d ' ')"
ts_files="$(find .rulebound/rules/typescript -name '*.md' | wc -l | tr -d ' ')"
sec_files="$(find .rulebound/rules/security -name '*.md' | wc -l | tr -d ' ')"
if [[ "${starter_files}" -lt 1 ]]; then
  fail "starter pack copied 0 .md files"
fi
if [[ "${ts_files}" -lt 1 ]]; then
  fail "typescript pack copied 0 .md files"
fi
if [[ "${sec_files}" -lt 1 ]]; then
  fail "security pack copied 0 .md files"
fi
# starter must NOT pull analyzer-* files
if find .rulebound/rules/starter -name '*-pack.md' | grep -q .; then
  fail "starter pack unexpectedly contains analyzer-* (*-pack.md) rules"
fi
log "pack install green: starter=${starter_files}, typescript=${ts_files}, security=${sec_files}"

log "rulebound check on starter-only project (must exit 0 — starter pack is pure deterministic)"
set +e
STARTER_CHECK="$("${RULEBOUND_BIN}" check --format json 2>/dev/null)"
STARTER_CODE=$?
set -e
# PACK-001 strict: starter pack has no analyzers, no command checks, and no
# waivable failures on a fresh repo. Exit 1 here would indicate either a
# regression in the starter rule set or a leak of analyzer-* content into
# the starter sources.
if [[ "${STARTER_CODE}" -ne 0 ]]; then
  fail "rulebound check on starter-only project must exit 0 (got ${STARTER_CODE})"
fi
if ! node -e "const r = JSON.parse(process.argv[1]); if (!r.summary || typeof r.summary.pass !== 'number') process.exit(1)" "${STARTER_CHECK}"; then
  fail "starter check JSON did not include a valid summary"
fi
log "starter check JSON looks valid (exit ${STARTER_CODE})"
popd >/dev/null
rm -rf "${PACK_TMP}"

log "rulebound check rejects invalid waivers (fail-closed) for json format"
WAIVER_TMP="$(mktemp -d -t rulebound-smoke-waiver.XXXXXX)"
pushd "${WAIVER_TMP}" >/dev/null
git init -q
git config user.email "smoke@rulebound.local"
git config user.name "smoke"
"${RULEBOUND_BIN}" init --no-hook >/dev/null
mkdir -p .rulebound
cat > .rulebound/waivers.yaml <<'YAML'
waivers:
  - rule: r1
    reason: "missing owner and expires"
YAML
set +e
"${RULEBOUND_BIN}" check --format json >/dev/null 2>/dev/null
WAIVER_CODE=$?
set -e
if [[ "${WAIVER_CODE}" -ne 2 ]]; then
  fail "invalid waivers should fail closed with exit 2, got ${WAIVER_CODE}"
fi
log "invalid waivers fail-closed: exit ${WAIVER_CODE}"
popd >/dev/null
rm -rf "${WAIVER_TMP}"

# ─────────────────────────────────────────────────────────────────────────────
# README quickstart smoke (CLI-001)
#
# Hard-coded commands that mirror docs/quickstart.md sections 2 → 4. Drift
# between README and the actual CLI is covered by the docs drift checker in
# Wave 4 (DOC-002); this stage only proves the documented commands run.
# ─────────────────────────────────────────────────────────────────────────────
log "quickstart smoke: rulebound init --pack starter --no-hook + doctor + check"
QS_TMP="$(mktemp -d -t rulebound-smoke-quickstart.XXXXXX)"
pushd "${QS_TMP}" >/dev/null
git init -q
git config user.email "smoke@rulebound.local"
git config user.name "smoke"

# Step 1: init with the starter pack and no hook (quickstart section 2).
"${RULEBOUND_BIN}" init --pack starter --no-hook >/dev/null
if [[ ! -d ".rulebound/rules/starter" ]]; then
  fail "quickstart: init --pack starter did not create .rulebound/rules/starter"
fi
qs_rule_count="$(find .rulebound/rules/starter -name '*.md' | wc -l | tr -d ' ')"
if [[ "${qs_rule_count}" -lt 1 ]]; then
  fail "quickstart: starter pack copied 0 .md files"
fi
log "quickstart: starter rules copied: ${qs_rule_count}"

# Step 2: doctor (quickstart section 3). Doctor exits 0 on a freshly
# initialized repo (rules dir found, config present, no analyzer rules).
set +e
"${RULEBOUND_BIN}" doctor >/dev/null 2>&1
QS_DOCTOR_CODE=$?
set -e
if [[ "${QS_DOCTOR_CODE}" -ne 0 ]]; then
  fail "quickstart: doctor exited ${QS_DOCTOR_CODE} on a fresh repo (expected 0)"
fi
log "quickstart: doctor exit ${QS_DOCTOR_CODE}"

# Step 3: check (quickstart section 4). On a fresh starter repo this is exit 0.
set +e
QS_CHECK_OUT="$("${RULEBOUND_BIN}" check --format json 2>/dev/null)"
QS_CHECK_CODE=$?
set -e
if [[ "${QS_CHECK_CODE}" -ne 0 ]]; then
  fail "quickstart: rulebound check on a fresh starter repo must exit 0 (got ${QS_CHECK_CODE})"
fi
if ! node -e "const r = JSON.parse(process.argv[1]); if (!r.summary || typeof r.summary.pass !== 'number') process.exit(1)" "${QS_CHECK_OUT}"; then
  fail "quickstart: rulebound check JSON did not include a valid summary"
fi
log "quickstart: check exit ${QS_CHECK_CODE} with valid JSON summary"

popd >/dev/null
rm -rf "${QS_TMP}"

log "PASS — packaging smoke test green"
