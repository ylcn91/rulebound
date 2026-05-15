#!/usr/bin/env bash
#
# Secret-scan release gate (AMP91-SEC-001).
#
# Wraps gitleaks against the repository. Called by:
#   - `scripts/release-gate.sh` stage 9 (when Team A wires the hook),
#   - `.github/workflows/ci.yml` on PR / push,
#   - nightly history scan via the dependency-scan workflow (or operator
#     hands-on).
#
# Contract (matches the release-gate stage skeleton):
#   - exit 0  -> clean, no secrets found
#   - exit 1  -> findings present, or fatal config error
#   - exit 2  -> gitleaks is not installed (actionable error, see C5)
#
# Modes:
#   - default          -> scan the working tree (no-git). Fast (~1s).
#                        Suitable for PR / pre-commit / local dev runs.
#   - --history        -> scan committed git history. Slower; nightly CI.
#   - --since <ref>    -> scan history since <ref> (for incremental CI runs).
#
# Per lead C5: gitleaks MUST be installed. There is no silent skip path —
# missing tool prints an install URL and fails the gate. CI is the binding
# gate; local dev may install via Homebrew or the upstream release tarball.

set -uo pipefail

cd "$(dirname "$0")/.."

MODE="working-tree"
SINCE_REF=""

for arg in "$@"; do
  case "$arg" in
    --history)
      MODE="history"
      ;;
    --since=*)
      MODE="since"
      SINCE_REF="${arg#--since=}"
      ;;
    --help|-h)
      sed -n '1,/^set -uo/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "secret-scan: unknown flag: $arg" >&2
      echo "Usage: bash scripts/secret-scan.sh [--history | --since=<ref>]" >&2
      exit 1
      ;;
  esac
done

if ! command -v gitleaks >/dev/null 2>&1; then
  cat >&2 <<'EOF'
secret-scan: gitleaks is not installed.

The Rulebound release gate requires gitleaks for the secret-scan stage.
Install it before re-running this script:

  macOS:    brew install gitleaks
  Linux:    https://github.com/gitleaks/gitleaks/releases
            (download the platform-specific tarball, extract gitleaks to a
             directory on $PATH, then `chmod +x` it)
  CI:       use `gacts/gitleaks@v1` or the official
            `gitleaks/gitleaks-action@v2` GitHub Action

After installing, re-run:

  bash scripts/secret-scan.sh

If you are running this from a release-gate stage and gitleaks cannot be
installed in your environment, the release MUST be blocked manually until
the gate can be re-run with the tool available — there is no waiver path
for a missing scanner (see docs/threat-model/secret-scan.md).
EOF
  exit 2
fi

CONFIG_PATH=".gitleaks.toml"
if [ ! -f "$CONFIG_PATH" ]; then
  echo "secret-scan: $CONFIG_PATH missing — refusing to run with default ruleset." >&2
  echo "The Rulebound allowlist is needed to avoid false positives in fixtures and docs." >&2
  exit 1
fi

REPORT_DIR="${RULEBOUND_SECRET_SCAN_REPORT_DIR:-.}"
mkdir -p "$REPORT_DIR"
REPORT_PATH="$REPORT_DIR/gitleaks-report.json"

echo "secret-scan: mode=$MODE config=$CONFIG_PATH report=$REPORT_PATH"

case "$MODE" in
  working-tree)
    # Working-tree scan (no-git). Used for PR / branch context and as the
    # default release-gate stage 9. Walks tracked + untracked files; respects
    # .gitignore.
    gitleaks detect \
      --redact \
      --no-banner \
      --no-git \
      --config="$CONFIG_PATH" \
      --report-format=json \
      --report-path="$REPORT_PATH"
    SCAN_EXIT=$?
    ;;
  history)
    # Full git history scan. Slower; intended for nightly CI runs.
    gitleaks detect \
      --redact \
      --no-banner \
      --config="$CONFIG_PATH" \
      --report-format=json \
      --report-path="$REPORT_PATH"
    SCAN_EXIT=$?
    ;;
  since)
    if [ -z "$SINCE_REF" ]; then
      echo "secret-scan: --since requires a ref (e.g. --since=origin/main)" >&2
      exit 1
    fi
    gitleaks detect \
      --redact \
      --no-banner \
      --log-opts="$SINCE_REF..HEAD" \
      --config="$CONFIG_PATH" \
      --report-format=json \
      --report-path="$REPORT_PATH"
    SCAN_EXIT=$?
    ;;
  *)
    echo "secret-scan: internal error — unknown mode $MODE" >&2
    exit 1
    ;;
esac

# gitleaks exit codes:
#   0   -> no leaks
#   1   -> internal error
#   126 -> permission denied
# `--exit-code` flag overrides the leak-found code (default 1). We rely on
# the default 1 here so that any findings break the gate.
case "$SCAN_EXIT" in
  0)
    echo "secret-scan: PASS — no leaks found."
    exit 0
    ;;
  1)
    LEAK_COUNT="?"
    if [ -f "$REPORT_PATH" ] && command -v jq >/dev/null 2>&1; then
      LEAK_COUNT=$(jq 'length' "$REPORT_PATH" 2>/dev/null || echo "?")
    fi
    cat >&2 <<EOF

secret-scan: FAIL — gitleaks reported findings (count=$LEAK_COUNT).

Report: $REPORT_PATH

Next steps:
  1. Open the report and confirm whether each finding is a real secret
     or a false positive against $CONFIG_PATH.
  2. For a real leak: STOP. Do not commit a waiver. Follow the secret
     rotation procedure in docs/runbooks/secret-rotation.md, then
     remove the secret from history if it was committed.
  3. For a false positive: add a narrow allowlist entry to
     $CONFIG_PATH with an inline rationale comment and an
     AMP91-SEC-001-FP-NN reference (see docs/threat-model/secret-scan.md
     for the waiver policy and reviewer requirements).
  4. Re-run: bash scripts/secret-scan.sh
EOF
    exit 1
    ;;
  *)
    echo "secret-scan: gitleaks exited with code $SCAN_EXIT — treating as failure." >&2
    exit 1
    ;;
esac
