import { execSync } from "node:child_process"
import chalk from "chalk"
import { findRulesDir, loadLocalRules, matchRulesByContext, validatePlanAgainstRules } from "../lib/local-rules.js"
import { loadRulesWithInheritance, getProjectConfig } from "../lib/inheritance.js"
import type { ValidationReport } from "../lib/local-rules.js"

interface DiffOptions {
  dir?: string
  ref?: string
  format?: string
}

export async function diffCommand(options: DiffOptions): Promise<void> {
  const ref = options.ref ?? "HEAD"
  let diffText: string

  try {
    diffText = execSync(`git diff ${ref}`, { encoding: "utf-8" })
  } catch {
    try {
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
  let allRules
  if (options.dir) {
    allRules = loadLocalRules(options.dir)
  } else {
    allRules = loadRulesWithInheritance(process.cwd())
  }

  if (allRules.length === 0) {
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
    .filter((l) => l.startsWith("+++ b/"))
    .map((l) => l.replace(/^\+\+\+ b\//, ""))

  // Smart context matching
  const projectConfig = getProjectConfig(process.cwd())
  const rules = matchRulesByContext(allRules, projectConfig, addedLines.slice(0, 2000))

  console.log()
  console.log(chalk.white.bold("DIFF VALIDATION"))
  console.log(chalk.dim(`Ref: ${ref}`))
  console.log(chalk.dim(`Files changed: ${filesChanged.length}`))

  if (filesChanged.length > 0) {
    for (const f of filesChanged.slice(0, 10)) {
      console.log(chalk.dim(`  ${f}`))
    }
    if (filesChanged.length > 10) {
      console.log(chalk.dim(`  ... and ${filesChanged.length - 10} more`))
    }
  }

  // Validate diff content against rules
  const report = validatePlanAgainstRules(addedLines, rules, `Diff against ${ref}`)

  // JSON output
  if (options.format === "json") {
    console.log(JSON.stringify({ ...report, filesChanged }, null, 2))
    if (report.status === "FAILED") process.exit(1)
    return
  }

  console.log(chalk.dim("\u2500".repeat(50)))
  console.log()

  // Only show non-PASS results for diff (more useful)
  const actionable = report.results.filter((r) => r.status !== "PASS")

  if (actionable.length === 0) {
    console.log(chalk.green("  All changes comply with matched rules."))
    console.log()
    console.log(chalk.dim(`  ${report.results.length} rules checked, all passed.`))
    return
  }

  for (const item of actionable) {
    const icon = item.status === "VIOLATED" ? chalk.red("\u2717") : chalk.yellow("\u25CB")
    const statusTag = item.status === "VIOLATED" ? chalk.red(`[VIOLATED]`) : chalk.yellow(`[NOT COVERED]`)
    const modTag = chalk.dim(`${item.modality.toUpperCase()}:`)

    console.log(`  ${icon} ${statusTag} ${modTag} ${chalk.white.bold(item.ruleTitle)}`)
    console.log(chalk.dim(`    ${item.reason}`))
    if (item.suggestedFix) {
      console.log(chalk.yellow(`    \u2192 ${item.suggestedFix}`))
    }
    console.log()
  }

  console.log(chalk.dim("\u2500".repeat(50)))
  console.log(
    `  ${chalk.green(`${report.summary.pass} PASS`)} | ` +
    `${chalk.red(`${report.summary.violated} VIOLATED`)} | ` +
    `${chalk.yellow(`${report.summary.notCovered} NOT COVERED`)}`
  )
  console.log()

  if (report.status === "FAILED") {
    console.log(chalk.red.bold("FAILED \u2014 review changes before committing"))
    process.exit(1)
  } else {
    console.log(chalk.yellow("PASSED with warnings"))
  }
}
