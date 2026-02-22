import { execSync } from "node:child_process"
import chalk from "chalk"
import { findRulesDir, loadLocalRules, filterRules, validatePlanAgainstRules } from "../lib/local-rules.js"
import { loadRulesWithInheritance } from "../lib/inheritance.js"

interface DiffOptions {
  dir?: string
  ref?: string
}

export async function diffCommand(options: DiffOptions): Promise<void> {
  // Get git diff
  const ref = options.ref ?? "HEAD"
  let diffText: string

  try {
    diffText = execSync(`git diff ${ref}`, { encoding: "utf-8" })
  } catch {
    try {
      // Maybe it's the first commit
      diffText = execSync("git diff --cached", { encoding: "utf-8" })
    } catch {
      console.error(chalk.red("Failed to get git diff. Are you in a git repository?"))
      process.exit(1)
    }
  }

  if (!diffText.trim()) {
    console.log(chalk.dim("No changes detected."))
    return
  }

  // Load rules
  let rules
  if (options.dir) {
    rules = loadLocalRules(options.dir)
  } else {
    rules = loadRulesWithInheritance(process.cwd())
  }

  if (rules.length === 0) {
    console.error(chalk.red("No rules found."))
    process.exit(1)
  }

  // Extract context from diff
  const addedLines = diffText
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1))
    .join("\n")

  const filesChanged = diffText
    .split("\n")
    .filter((l) => l.startsWith("+++ b/") || l.startsWith("--- a/"))
    .map((l) => l.replace(/^[+-]{3} [ab]\//, ""))
    .filter((v, i, a) => a.indexOf(v) === i)

  console.log()
  console.log(chalk.white("DIFF VALIDATION"))
  console.log(chalk.dim(`Ref: ${ref}`))
  console.log(chalk.dim(`Files: ${filesChanged.length} changed`))
  console.log(chalk.dim("─".repeat(50)))
  console.log()

  // Find relevant rules based on diff content
  const relevantRules = filterRules(rules, { task: addedLines.slice(0, 2000) })

  if (relevantRules.length === 0) {
    console.log(chalk.green("No relevant rules for these changes."))
    return
  }

  // Validate
  const { results, summary } = validatePlanAgainstRules(addedLines, relevantRules)
  const relevant = results.filter((r) => r.status !== "PASS" || r.message !== "Rule not applicable to this plan.")

  if (relevant.length === 0) {
    console.log(chalk.green("All changes comply with rules."))
    return
  }

  for (const item of relevant) {
    const color = item.status === "PASS" ? chalk.green : item.status === "WARN" ? chalk.yellow : chalk.red
    console.log(`  ${color(`[${item.status}]`)} ${chalk.dim(`[${item.modality.toUpperCase()}]`)} ${chalk.white(item.ruleTitle)}`)
    console.log(chalk.dim(`    ${item.message}`))
    console.log()
  }

  console.log(chalk.dim("─".repeat(50)))
  console.log(
    `  ${chalk.green(`Pass: ${summary.pass}`)}  ${chalk.yellow(`Warn: ${summary.warn}`)}  ${chalk.red(`Fail: ${summary.fail}`)}`
  )
  console.log()

  if (summary.fail > 0) {
    console.log(chalk.red("FAILED — Review changes before committing."))
    process.exit(1)
  } else if (summary.warn > 0) {
    console.log(chalk.yellow("PASSED with warnings."))
  } else {
    console.log(chalk.green("PASSED."))
  }
}
