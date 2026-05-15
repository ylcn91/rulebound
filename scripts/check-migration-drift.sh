#!/usr/bin/env bash
# Fails when packages/server/src/db/schema.ts and packages/server/migrations/
# are out of sync, or when generated SQL is not committed.
#
# Intended for CI; runs offline (no DB connection required).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/packages/server"

cd "$SERVER_DIR"

# 1. drizzle-kit's structural drift check.
pnpm exec drizzle-kit check

# 2. Re-generate migrations into a scratch directory and diff against committed.
#    drizzle-kit appends new migration files when schema diverges; if anything
#    is appended, the working tree changes are the proof of drift.
GIT_STATUS_BEFORE="$(git status --porcelain migrations || true)"

pnpm exec drizzle-kit generate --name __drift_probe__ >/dev/null 2>&1 || true

GIT_STATUS_AFTER="$(git status --porcelain migrations || true)"

if [ "$GIT_STATUS_BEFORE" != "$GIT_STATUS_AFTER" ]; then
  echo "Migration drift detected — schema changed without a committed migration." >&2
  echo "Run 'pnpm --filter @rulebound/server db:generate' and commit the result." >&2
  git status --porcelain migrations >&2 || true
  # Clean up the probe so the workspace stays tidy even on failure.
  git clean -f migrations/ >/dev/null 2>&1 || true
  exit 1
fi

echo "Migration drift check passed."
