import { readFileSync } from "node:fs"
import chalk from "chalk"
import { loadLocalRules, matchRulesByContext } from "../lib/local-rules.js"
import { loadRulesWithInheritance, getProjectConfig } from "../lib/inheritance.js"
import { validateWithPipeline } from "../lib/validation.js"
import type { ValidationReport } from "../lib/local-rules.js"

interface ValidateOptions {
  plan?: string
  file?: string
  dir?: string
  format?: string
  llm?: boolean
}

const STATUS_ICONS: Record<string, { icon: string; color: (s: string) => string }> = {
  PASS: { icon: "\u2713", color: chalk.green },
  VIOLATED: { icon: "\u2717", color: chalk.red },
  NOT_COVERED: { icon: "\u25CB", color: chalk.yellow },
}

function printReport(report: ValidationReport): void {
  console.log()
  console.log(chalk.white.bold("VALIDATION REPORT"))
  console.log(chalk.white("\u2550".repeat(62)))
  console.log()
  console.log(chalk.dim(`  Task: ${report.task}`))
  console.log(chalk.dim(`  Rules matched: ${report.rulesMatched} of ${report.rulesTotal}`))
  console.log(chalk.dim("\u2500".repeat(62)))
  console.log()

  for (const item of report.results) {
    const display = STATUS_ICONS[item.status] ?? STATUS_ICONS.NOT_COVERED
    const modalityTag = item.modality.toUpperCase()
    const statusTag = display.color(`[${item.status}]`)

    console.log(`  ${display.color(display.icon)} ${statusTag} ${chalk.dim(`${modalityTag}:`)} ${chalk.white.bold(item.ruleTitle)}`)
    console.log(chalk.dim(`    ${item.reason}`))

    if (item.suggestedFix) {
      console.log(chalk.yellow(`    \u2192 ${item.suggestedFix}`))
    }

    console.log()
  }

  console.log(chalk.dim("\u2500".repeat(62)))
  console.log(
    `  ${chalk.green(`${report.summary.pass} PASS`)} | ` +
    `${chalk.red(`${report.summary.violated} VIOLATED`)} | ` +
    `${chalk.yellow(`${report.summary.notCovered} NOT COVERED`)}`
  )
  console.log()

  switch (report.status) {
    case "FAILED":
      console.log(chalk.red.bold("FAILED \u2014 resolve violations before proceeding"))
      break
    case "PASSED_WITH_WARNINGS":
      console.log(chalk.yellow("PASSED with warnings \u2014 review NOT COVERED rules"))
      break
    case "PASSED":
      console.log(chalk.green.bold("PASSED \u2014 all rules satisfied"))
      break
  }
}

export async function validateCommand(options: ValidateOptions): Promise<void> {
  // Get plan text
  let planText: string

  if (options.file) {
    try {
      planText = readFileSync(options.file, "utf-8")
    } catch {
      console.error(chalk.red(`Failed to read file: ${options.file}`))
      process.exit(1)
    }
  } else if (options.plan) {
    planText = options.plan
  } else {
    console.error(chalk.red("Provide --plan 'text' or --file path/to/plan.md"))
    process.exit(1)
  }

  // Load rules (with inheritance support)
  let allRules
  if (options.dir) {
    allRules = loadLocalRules(options.dir)
  } else {
    allRules = loadRulesWithInheritance(process.cwd())
  }

  if (allRules.length === 0) {
    console.error(chalk.red("No rules found."))
    console.error(chalk.dim("Run 'rulebound init' to create rules, or use --dir <path>."))
    process.exit(1)
  }

  // Smart context matching
  const projectConfig = getProjectConfig(process.cwd())
  const rules = matchRulesByContext(allRules, projectConfig, planText)

  // Validate
  const report = await validateWithPipeline({
    plan: planText,
    rules,
    task: planText.slice(0, 100),
    useLlm: options.llm,
  })

  // JSON output
  if (options.format === "json") {
    console.log(JSON.stringify(report, null, 2))
    if (report.status === "FAILED") process.exit(1)
    return
  }

  // Pretty print
  printReport(report)

  if (report.status === "FAILED") {
    process.exit(1)
  }
}
