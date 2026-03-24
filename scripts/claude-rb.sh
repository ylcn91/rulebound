#!/usr/bin/env bash
# Rulebound-enforced Claude Code launcher
# Usage: ./scripts/claude-rb.sh [claude args...]
#
# Starts the Rulebound Gateway proxy, then launches Claude Code
# with all traffic routed through it. Rules are automatically
# injected into every request and responses are scanned.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GATEWAY_PORT="${GATEWAY_PORT:-4001}"
GATEWAY_PID=""

cleanup() {
  if [ -n "$GATEWAY_PID" ] && kill -0 "$GATEWAY_PID" 2>/dev/null; then
    kill "$GATEWAY_PID" 2>/dev/null
    wait "$GATEWAY_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Kill any existing gateway on the port
lsof -ti :"$GATEWAY_PORT" | xargs kill -9 2>/dev/null || true
sleep 0.3

# Build gateway if dist doesn't exist
if [ ! -f "$PROJECT_DIR/packages/gateway/dist/index.js" ]; then
  echo "[rulebound] Building gateway..."
  pnpm --filter @rulebound/gateway build
fi

# Start gateway in background
GATEWAY_LOG="/tmp/rulebound-gateway.log"

GATEWAY_PORT="$GATEWAY_PORT" \
RULEBOUND_STACK=typescript,react,nextjs,node \
RULEBOUND_INJECT_RULES=true \
RULEBOUND_SCAN_RESPONSES=true \
RULEBOUND_ENFORCEMENT=strict \
node "$PROJECT_DIR/packages/gateway/dist/index.js" > "$GATEWAY_LOG" 2>&1 &
GATEWAY_PID=$!

# Wait for gateway to be ready
for i in $(seq 1 10); do
  if curl -sf "http://localhost:$GATEWAY_PORT/health" > /dev/null 2>&1; then
    break
  fi
  sleep 0.3
done

if ! curl -sf "http://localhost:$GATEWAY_PORT/health" > /dev/null 2>&1; then
  echo "[rulebound] Gateway failed to start on port $GATEWAY_PORT"
  exit 1
fi

echo "[rulebound] Gateway :$GATEWAY_PORT strict | logs: $GATEWAY_LOG"

# Launch Claude Code through the gateway
ANTHROPIC_BASE_URL="http://localhost:$GATEWAY_PORT/anthropic" \
CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude-admin}" \
claude --dangerously-skip-permissions "$@"
