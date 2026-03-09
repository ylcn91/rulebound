import { writeFileSync, chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs"
import { resolve } from "node:path"
import chalk from "chalk"
import { PRE_COMMIT_HOOK_CONTENT } from "../lib/pre-commit-hook.js"

interface HookOptions {
  remove?: boolean
}

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

  writeFileSync(hookPath, PRE_COMMIT_HOOK_CONTENT)
  chmodSync(hookPath, 0o755)

  console.log()
  console.log(chalk.white("Pre-commit hook installed."))
  console.log(chalk.dim(`  ${hookPath}`))
  console.log()
  console.log(chalk.dim("Every commit will now validate changes against your rules."))
  console.log(chalk.dim("Remove with: rulebound hook --remove"))
}
