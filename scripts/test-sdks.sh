#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

have() {
  command -v "$1" >/dev/null 2>&1
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

if have dotnet; then
  cd "$ROOT_DIR/sdks/dotnet"
  dotnet test Rulebound.Tests/Rulebound.Tests.csproj -c Release
else
  echo "Skipping .NET SDK tests; dotnet is not installed."
fi

if have cargo; then
  cd "$ROOT_DIR/sdks/rust"
  cargo test
fi
