import { execSync } from "node:child_process"
import { join, resolve } from "node:path"
import { existsSync } from "node:fs"
import chalk from "chalk"
import { findRulesDir, loadLocalRules } from "../lib/local-rules.js"

interface HistoryOptions {
  dir?: string
  limit?: string
}

export async function historyCommand(id: string, options: HistoryOptions): Promise<void> {
  const rulesDir = options.dir ?? findRulesDir(process.cwd())

  if (!rulesDir) {
    console.error(chalk.red("No rules directory found."))
    process.exit(1)
  }

  const rules = loadLocalRules(rulesDir)
  const rule = rules.find((r) => r.id === id || r.filePath.includes(id))

  if (!rule) {
    console.error(chalk.red(`Rule not found: ${id}`))
    console.error(chalk.dim("Use 'rulebound rules list' to see available rules."))
    process.exit(1)
  }

  const filePath = resolve(rulesDir, rule.filePath)

  if (!existsSync(filePath)) {
    console.error(chalk.red(`File not found: ${filePath}`))
    process.exit(1)
  }

  // Check if we're in a git repo
  try {
    execSync("git rev-parse --git-dir", { cwd: rulesDir, stdio: "pipe" })
  } catch {
    console.error(chalk.red("Not a git repository. Rule versioning requires git."))
    console.error(chalk.dim("Initialize git: git init && git add . && git commit -m 'initial'"))
    process.exit(1)
  }

  const limit = parseInt(options.limit ?? "20", 10)

  console.log()
  console.log(chalk.white("VERSION HISTORY"))
  console.log(chalk.dim(`Rule: ${rule.title}`))
  console.log(chalk.dim(`File: ${rule.filePath}`))
  console.log(chalk.dim("─".repeat(60)))
  console.log()

  try {
    const log = execSync(
      `git log --follow --format="%H|%h|%ai|%an|%s" -n ${limit} -- "${filePath}"`,
      { cwd: rulesDir, encoding: "utf-8" }
    ).trim()

    if (!log) {
      console.log(chalk.dim("  No git history for this file."))
      console.log(chalk.dim("  Commit the file to start tracking versions."))
      return
    }

    const entries = log.split("\n")

    for (let i = 0; i < entries.length; i++) {
      const [hash, shortHash, date, author, subject] = entries[i].split("|")
      const version = entries.length - i
      const dateStr = date.split(" ").slice(0, 2).join(" ")

      console.log(`  ${chalk.dim(`v${version}`)} ${chalk.white(shortHash)} ${chalk.dim(dateStr)}`)
      console.log(`    ${chalk.white(subject)} ${chalk.dim(`— ${author}`)}`)

      // Show diff stats for non-first commit
      if (i < entries.length - 1) {
        try {
          const parentHash = entries[i + 1].split("|")[0]
          const diffStat = execSync(
            `git diff --stat ${parentHash}..${hash} -- "${filePath}"`,
            { cwd: rulesDir, encoding: "utf-8" }
          ).trim()

          const statLine = diffStat.split("\n").pop() ?? ""
          if (statLine) {
            console.log(chalk.dim(`    ${statLine.trim()}`))
          }
        } catch {
          // ignore diff errors
        }
      }

      console.log()
    }

    console.log(chalk.dim(`${entries.length} version${entries.length === 1 ? "" : "s"}`))

    // Show how to diff versions
    if (entries.length > 1) {
      const latest = entries[0].split("|")[1]
      const oldest = entries[entries.length - 1].split("|")[1]
      console.log()
      console.log(chalk.dim(`Diff versions: git diff ${oldest}..${latest} -- ${rule.filePath}`))
    }
  } catch (error) {
    console.error(chalk.red("Failed to read git history."))
    process.exit(1)
  }
}
