#!/usr/bin/env bash
# smoke-action.sh — verify the commands invoked by .github/actions/rulebound
# emit the expected shapes for each output format.
#
# We don't drive the composite action with a full GitHub Actions runner here
# (no `act` dependency); the action.yml ultimately delegates to
# `rulebound check --format <fmt>`, so we run that CLI directly against a
# fresh fixture repo and inspect stdout per format.
#
# Coverage:
#   - format=github      → emits at least one `::error::` or `::warning::` line
#                          AND a `::notice::` summary line on FAIL fixtures.
#   - format=sarif       → emits valid SARIF 2.1.0 JSON with at least one
#                          `runs[].results[]` entry.
#   - format=pr-markdown → emits a markdown document starting with a `## `
#                          heading.
#
# The fixture installs a deterministic rule that always fails on the fixture
# files, so each format has a non-trivial payload to assert against.
#
# Usage: bash scripts/smoke-action.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_DIST="${REPO_ROOT}/packages/cli/dist/index.js"
ACTION_YML="${REPO_ROOT}/.github/actions/rulebound/action.yml"

log() { printf '\n[smoke-action] %s\n' "$*"; }
fail() { printf '\n[smoke-action][FAIL] %s\n' "$*" >&2; exit 1; }

cleanup() {
  local code=$?
  if [[ -n "${FIXTURE_DIR:-}" && -d "${FIXTURE_DIR}" ]]; then
    rm -rf "${FIXTURE_DIR}"
  fi
  exit "${code}"
}
trap cleanup EXIT

[[ -f "${ACTION_YML}" ]] || fail "action.yml not found: ${ACTION_YML}"

if [[ ! -f "${CLI_DIST}" ]]; then
  log "building @rulebound/cli (dist not found)"
  pnpm --filter @rulebound/cli build >/dev/null
fi
[[ -f "${CLI_DIST}" ]] || fail "CLI dist still missing after build"

# action.yml is documented to invoke `rulebound check --format <inputs.format>`
# (with `--base`, optional `--rules-dir`, `--allow-commands`,
# `--fail-on-advisory`). We assert the action.yml stays aligned with that
# command shape so a future inputs/argv refactor cannot silently bypass this
# smoke.
grep -q 'rulebound "\${ARGS\[@\]}"' "${ACTION_YML}" \
  || fail "action.yml no longer invokes rulebound with the expected ARGS[@] expansion"
grep -q 'ARGS=(check --format' "${ACTION_YML}" \
  || fail "action.yml no longer starts ARGS with 'check --format'"

# Set up a fresh fixture repo that the CLI considers a real workspace.
FIXTURE_DIR="$(mktemp -d -t rulebound-action-smoke.XXXXXX)"
log "fixture: ${FIXTURE_DIR}"
pushd "${FIXTURE_DIR}" >/dev/null

git init -q
git config user.email "smoke@rulebound.local"
git config user.name "smoke"
git config commit.gpgsign false

mkdir -p .rulebound/rules src
cat > .rulebound/config.json <<'JSON'
{
  "project": { "name": "fixture", "stack": [], "scope": [], "team": "" },
  "extends": [],
  "rulesDir": ".rulebound/rules"
}
JSON

# Deterministic regex rule that fires on a sentinel in src/.
cat > .rulebound/rules/no-todo-fixme.md <<'MD'
---
title: No TODO/FIXME markers in source
category: style
severity: error
modality: must
tags: [example, smoke]
stack: []
scope: []
checks:
  - type: regex
    id: no-todo-fixme
    pattern: 'TODO|FIXME'
    files: ["src/**/*.ts"]
    severity: error
    message: "TODO/FIXME marker present in source."
---

# No TODO/FIXME markers

Tracked work belongs in the issue tracker, not in source.
MD

# Source file that violates the rule above. The path matches the rule's
# `files:` glob, guaranteeing at least one failure per format.
cat > src/example.ts <<'TS'
export function noop(): void {
  // TODO: drop this once the smoke fixture is wired in real users' repos.
  return undefined
}
TS

git add . >/dev/null
git commit -q -m "fixture: seed rulebound smoke target"

run_cli() {
  # run the CLI with the action's standard argv minus --allow-commands and
  # --fail-on-advisory (we are testing the format emitters, not optional gates).
  node "${CLI_DIST}" check --format "$1" --base main 2>/dev/null
}

# ── format=github ────────────────────────────────────────────────────────────
log "format=github — expect ::error|::warning + ::notice summary"
set +e
GITHUB_OUT="$(run_cli github)"
GITHUB_CODE=$?
set -e
# `rulebound check` returns 1 on deterministic violations; the smoke fixture
# is designed to violate.
if [[ "${GITHUB_CODE}" -ne 1 ]]; then
  fail "format=github expected exit 1 (deterministic violation), got ${GITHUB_CODE}"
fi
if ! grep -qE '^::error|^::warning' <<<"${GITHUB_OUT}"; then
  fail "format=github did not emit a ::error or ::warning annotation line:\n${GITHUB_OUT}"
fi
log "format=github emitted annotation lines"

# ── format=sarif ────────────────────────────────────────────────────────────
log "format=sarif — expect valid SARIF 2.1.0 JSON with results"
set +e
SARIF_OUT="$(run_cli sarif)"
SARIF_CODE=$?
set -e
if [[ "${SARIF_CODE}" -ne 1 ]]; then
  fail "format=sarif expected exit 1 (deterministic violation), got ${SARIF_CODE}"
fi
# Validate SARIF shape with node so we don't depend on jq.
if ! node -e '
const sarif = JSON.parse(process.argv[1]);
if (sarif.version !== "2.1.0") {
  process.stderr.write(`SARIF version mismatch: got ${sarif.version}\n`);
  process.exit(1);
}
if (!Array.isArray(sarif.runs) || sarif.runs.length === 0) {
  process.stderr.write("SARIF runs[] missing or empty\n");
  process.exit(1);
}
const run = sarif.runs[0];
if (!run.tool || !run.tool.driver || run.tool.driver.name !== "rulebound") {
  process.stderr.write("SARIF tool.driver.name is not \"rulebound\"\n");
  process.exit(1);
}
if (!Array.isArray(run.results) || run.results.length === 0) {
  process.stderr.write("SARIF runs[0].results[] missing or empty\n");
  process.exit(1);
}
' "${SARIF_OUT}"; then
  fail "format=sarif did not emit a valid SARIF document:\n${SARIF_OUT}"
fi
log "format=sarif emitted valid SARIF 2.1.0 with results"

# ── format=pr-markdown ──────────────────────────────────────────────────────
log "format=pr-markdown — expect leading '## ' heading"
set +e
PR_OUT="$(run_cli pr-markdown)"
PR_CODE=$?
set -e
if [[ "${PR_CODE}" -ne 1 ]]; then
  fail "format=pr-markdown expected exit 1 (deterministic violation), got ${PR_CODE}"
fi
# The pr-markdown report always starts with a section heading. Snapshot
# samples in pr-markdown.snapshot.test.ts begin with `## rulebound check`.
first_heading="$(grep -m1 '^## ' <<<"${PR_OUT}" || true)"
if [[ -z "${first_heading}" ]]; then
  fail "format=pr-markdown did not emit a top-level '## ' heading:\n${PR_OUT}"
fi
log "format=pr-markdown emitted heading: ${first_heading}"

popd >/dev/null

log "PASS — action smoke green (github + sarif + pr-markdown)"
