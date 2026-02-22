import { writeFileSync, chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs"
import { resolve } from "node:path"
import chalk from "chalk"

interface HookOptions {
  remove?: boolean
}

const HOOK_CONTENT = `#!/bin/sh
# Rulebound pre-commit hook
# Validates staged changes against project rules

echo "Rulebound: validating changes..."

# Get staged diff
DIFF=$(git diff --cached)

if [ -z "$DIFF" ]; then
  exit 0
fi

# Run rulebound diff on staged changes
npx rulebound diff --ref HEAD 2>/dev/null

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "Rulebound: commit blocked. Fix rule violations first."
  echo "Run 'rulebound diff' for details."
  exit 1
fi

exit 0
`

export async function hookCommand(options: HookOptions): Promise<void> {
  const cwd = process.cwd()
  const gitDir = resolve(cwd, ".git")

  if (!existsSync(gitDir)) {
    console.error(chalk.red("Not a git repository."))
    process.exit(1)
  }

  const hooksDir = resolve(gitDir, "hooks")
  const hookPath = resolve(hooksDir, "pre-commit")

  if (options.remove) {
    if (existsSync(hookPath)) {
      unlinkSync(hookPath)
      console.log(chalk.white("Pre-commit hook removed."))
    } else {
      console.log(chalk.dim("No pre-commit hook found."))
    }
    return
  }

  if (!existsSync(hooksDir)) {
    mkdirSync(hooksDir, { recursive: true })
  }

  writeFileSync(hookPath, HOOK_CONTENT)
  chmodSync(hookPath, 0o755)

  console.log()
  console.log(chalk.white("Pre-commit hook installed."))
  console.log(chalk.dim(`  ${hookPath}`))
  console.log()
  console.log(chalk.dim("Every commit will now validate changes against your rules."))
  console.log(chalk.dim("Remove with: rulebound hook --remove"))
}
