import { readFileSync } from "node:fs"
import chalk from "chalk"
import { findRulesDir, loadLocalRules, validatePlanAgainstRules } from "../lib/local-rules.js"
import { loadRulesWithInheritance } from "../lib/inheritance.js"

interface ValidateOptions {
  plan?: string
  file?: string
  dir?: string
}

const STATUS_DISPLAY: Record<string, { color: (s: string) => string }> = {
  PASS: { color: chalk.green },
  WARN: { color: chalk.yellow },
  FAIL: { color: chalk.red },
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
  let rules

  if (options.dir) {
    rules = loadLocalRules(options.dir)
  } else {
    rules = loadRulesWithInheritance(process.cwd())
  }

  if (rules.length === 0) {
    console.error(chalk.red("No rules found."))
    console.error(chalk.dim("Run 'rulebound init' to create rules, or use --dir <path>."))
    process.exit(1)
  }

  // Validate
  const { results, summary } = validatePlanAgainstRules(planText, rules)

  // Display results
  console.log()
  console.log(chalk.white("VALIDATION REPORT"))
  console.log(chalk.dim("─".repeat(60)))
  console.log()

  // Show only relevant results (non-PASS or applicable)
  const relevant = results.filter((r) => r.status !== "PASS" || r.message !== "Rule not applicable to this plan.")

  if (relevant.length === 0) {
    console.log(chalk.dim("  No rules matched this plan."))
  } else {
    for (const item of relevant) {
      const display = STATUS_DISPLAY[item.status] ?? STATUS_DISPLAY.WARN
      const statusTag = display.color(`[${item.status}]`)
      const modTag = chalk.dim(`[${item.modality.toUpperCase()}]`)

      console.log(`  ${statusTag} ${modTag} ${chalk.white(item.ruleTitle)}`)
      console.log(chalk.dim(`    ${item.message}`))
      console.log()
    }
  }

  console.log(chalk.dim("─".repeat(60)))
  console.log(
    `  Total: ${summary.total}  ` +
      chalk.green(`Pass: ${summary.pass}`) +
      "  " +
      chalk.yellow(`Warn: ${summary.warn}`) +
      "  " +
      chalk.red(`Fail: ${summary.fail}`)
  )
  console.log()

  if (summary.fail > 0) {
    console.log(chalk.red("FAILED — Fix failing rules before proceeding."))
    process.exit(1)
  }

  if (summary.warn > 0) {
    console.log(chalk.yellow("PASSED with warnings."))
  } else {
    console.log(chalk.green("PASSED — All rules satisfied."))
  }
}
