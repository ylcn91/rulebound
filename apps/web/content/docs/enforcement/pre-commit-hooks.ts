import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "enforcement/pre-commit-hooks",
  title: "Pre-Commit Hooks",
  description:
    "Automatically validate staged changes against your rules on every git commit with Rulebound pre-commit hooks.",
  content: `## Pre-Commit Hooks

Rulebound can install a git pre-commit hook that validates your staged changes against project rules before every commit. If violations are found, the commit is blocked.

### Installation

The hook is installed automatically when you run \`rulebound init\` (unless you pass \`--no-hook\`).

To install or reinstall manually:

\`\`\`bash
rulebound hook
\`\`\`

To remove:

\`\`\`bash
rulebound hook --remove
\`\`\`

### How It Works

The pre-commit hook runs this sequence:

1. Gets the staged diff with \`git diff --cached\`
2. If the diff is empty, exits with success (nothing to validate)
3. Runs \`npx rulebound diff --ref HEAD\` on the staged changes
4. If violations are found (exit code non-zero), blocks the commit

### Hook Content

The installed hook at \`.git/hooks/pre-commit\`:

\`\`\`bash
#!/bin/sh
# Rulebound pre-commit hook
# Validates staged changes against project rules

echo "Rulebound: validating changes..."

DIFF=$(git diff --cached)
if [ -z "$DIFF" ]; then
  exit 0
fi

npx rulebound diff --ref HEAD 2>/dev/null
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "Rulebound: commit blocked. Fix rule violations first."
  echo "Run 'rulebound diff' for details."
  exit 1
fi

exit 0
\`\`\`

### Bypassing the Hook

In emergencies, you can skip the hook:

\`\`\`bash
git commit --no-verify -m "emergency fix"
\`\`\`

> Use this sparingly. Skipped validations should be caught in CI.

### Enforcement Mode

The hook respects your enforcement mode setting. In \`advisory\` mode, violations are reported but the commit is not blocked (the diff command exits 0).

In \`moderate\` or \`strict\` mode, MUST violations (and SHOULD violations in strict) cause the diff command to exit non-zero, blocking the commit.

### Troubleshooting

**Hook not running?**
- Check that \`.git/hooks/pre-commit\` exists and is executable (\`chmod +x\`)
- Verify \`rulebound\` is installed (\`npx rulebound --version\`)

**Hook is slow?**
- The hook runs the full validation pipeline. Consider using advisory mode locally and strict mode in CI for faster commits.
- Avoid \`--llm\` in the hook (it requires API calls)

**Want to use with other hooks?**
- Rulebound only creates the hook if \`.git/hooks/pre-commit\` does not already exist
- If you have an existing hook manager (husky, lefthook), add \`npx rulebound diff --ref HEAD\` as a step in your existing setup
`,
}

export default doc
