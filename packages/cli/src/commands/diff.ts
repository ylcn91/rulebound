import chalk from "chalk"
import { loadLocalRules, matchRulesByContext } from "../lib/local-rules.js"
import { loadRulesWithInheritance, getProjectConfig } from "../lib/inheritance.js"
import { validateWithPipeline } from "../lib/validation.js"
import type { DiffSelection } from "../lib/git-diff.js"
import { extractAddedLines, extractChangedFiles, readGitDiff } from "../lib/git-diff.js"
import { recordCliValidationEvent } from "../lib/telemetry.js"

interface DiffOptions {
  readonly dir?: string
  readonly ref?: string
  readonly staged?: boolean
  readonly format?: string
  readonly llm?: boolean
}

export async function diffCommand(options: DiffOptions): Promise<void> {
  let diffSelection: DiffSelection
  try {
    diffSelection = readGitDiff({ ref: options.ref, staged: options.staged })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get git diff. Are you in a git repository?"
    console.error(chalk.red(message))
    process.exit(1)
  }

  const { diffText } = diffSelection

  if (!diffText.trim()) {
    console.log(chalk.dim("No changes detected."))
    return
  }

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

  const addedLines = extractAddedLines(diffText)
  const filesChanged = extractChangedFiles(diffText)

  const cwd = process.cwd()
  const projectConfig = getProjectConfig(cwd)
  const rules = matchRulesByContext(allRules, projectConfig, addedLines.slice(0, 2000))

  console.log()
  console.log(chalk.white.bold("DIFF VALIDATION"))
  if (diffSelection.kind === "ref") {
    console.log(chalk.dim(`Ref: ${diffSelection.label}`))
  } else {
    console.log(chalk.dim("Scope: staged changes"))
  }
  console.log(chalk.dim(`Files changed: ${filesChanged.length}`))

  if (filesChanged.length > 0) {
    for (const filePath of filesChanged.slice(0, 10)) {
      console.log(chalk.dim(`  ${filePath}`))
    }
    if (filesChanged.length > 10) {
      console.log(chalk.dim(`  ... and ${filesChanged.length - 10} more`))
    }
  }

  const report = await validateWithPipeline({
    plan: addedLines,
    rules,
    task: diffSelection.kind === "ref" ? `Diff against ${diffSelection.label}` : "Diff of staged changes",
    useLlm: options.llm,
  })
  recordCliValidationEvent(report, cwd)

  if (options.format === "json") {
    console.log(JSON.stringify({ ...report, filesChanged }, null, 2))
    if (report.status === "FAILED") process.exit(1)
    return
  }

  console.log(chalk.dim("\u2500".repeat(50)))
  console.log()

  const actionable = report.results.filter((result) => result.status !== "PASS")

  if (actionable.length === 0) {
    console.log(chalk.green("  All changes comply with matched rules."))
    console.log()
    console.log(chalk.dim(`  ${report.results.length} rules checked, all passed.`))
    return
  }

  for (const item of actionable) {
    const icon = item.status === "VIOLATED" ? chalk.red("\u2717") : chalk.yellow("\u25CB")
    const statusTag = item.status === "VIOLATED" ? chalk.red("[VIOLATED]") : chalk.yellow("[NOT COVERED]")
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
