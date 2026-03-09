export const PRE_COMMIT_HOOK_CONTENT = `#!/bin/sh
# Rulebound pre-commit hook
# Validates staged changes against project rules

echo "Rulebound: validating staged changes..."

if git diff --cached --quiet; then
  exit 0
fi

npx rulebound diff --staged 2>/dev/null
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "Rulebound: commit blocked. Fix rule violations first."
  echo "Run 'rulebound diff --staged' for details."
  exit 1
fi

exit 0
`
