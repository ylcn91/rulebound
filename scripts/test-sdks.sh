#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Optional environment knobs — release-gate.sh forwards these when needed.
SKIP_DOTNET="${SKIP_DOTNET:-0}"

have() {
  command -v "$1" >/dev/null 2>&1
}

dotnet_major() {
  dotnet --version 2>/dev/null | awk -F. 'NR==1 {print $1}'
}

require_dotnet8() {
  local v
  v=$(dotnet_major)
  if [ -z "$v" ]; then
    echo "FAIL: .NET SDK not detected on PATH. Install .NET 8/9 or pass --skip-dotnet." >&2
    return 1
  fi
  if [ "$v" -lt 8 ]; then
    echo "FAIL: dotnet ${v} < 8 (NETSDK1045 risk). Install .NET 8/9 or pass --skip-dotnet." >&2
    return 1
  fi
}

if have python3; then
  cd "$ROOT_DIR/sdks/python"
  python3 -m venv .venv
  source .venv/bin/activate
  python -m pip install --quiet --upgrade pip
  python -m pip install --quiet -e '.[dev]'
  python -m pytest
  deactivate
fi

if have go; then
  cd "$ROOT_DIR/sdks/go"
  go test ./...
fi

if have mvn; then
  cd "$ROOT_DIR/sdks/java"
  mvn -q test
fi

if [ "$SKIP_DOTNET" = "1" ]; then
  echo "Skipping .NET SDK tests (SKIP_DOTNET=1 / --skip-dotnet)."
else
  require_dotnet8
  cd "$ROOT_DIR/sdks/dotnet"
  dotnet test Rulebound.Tests/Rulebound.Tests.csproj -c Release
fi

if have cargo; then
  cd "$ROOT_DIR/sdks/rust"
  cargo test
fi
