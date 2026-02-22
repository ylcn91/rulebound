import { readFileSync } from "node:fs"
import chalk from "chalk"
import ora from "ora"
import type { ValidationResult } from "@rulebound/shared"
import { validatePlan } from "../lib/api.js"

interface ValidateOptions {
  plan?: string
  file?: string
}

const STATUS_DISPLAY: Record<string, { icon: string; color: (s: string) => string }> = {
  PASS: { icon: "+", color: chalk.green },
  WARN: { icon: "~", color: chalk.yellow },
  FAIL: { icon: "x", color: chalk.red },
}

export async function validateCommand(
  options: ValidateOptions
): Promise<void> {
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
    console.error(
      chalk.red("Provide --plan 'text' or --file path/to/plan.md")
    )
    process.exit(1)
  }

  const spinner = ora("Validating plan against rules...").start()

  const result = await validatePlan(planText)

  spinner.stop()

  if (!result.success || !result.data) {
    console.error(chalk.red(`Error: ${result.error ?? "Validation failed"}`))
    process.exit(1)
  }

  const { results, summary } = result.data

  console.log(chalk.blue("VALIDATION RESULTS"))
  console.log(chalk.dim("─".repeat(50)))
  console.log()

  for (const item of results) {
    printResult(item)
  }

  console.log(chalk.dim("─".repeat(50)))
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
    console.log(chalk.red("Validation FAILED. Fix failing rules before proceeding."))
    process.exit(1)
  }

  if (summary.warn > 0) {
    console.log(chalk.yellow("Validation passed with warnings."))
  } else {
    console.log(chalk.green("Validation passed."))
  }
}

function printResult(result: ValidationResult): void {
  const display = STATUS_DISPLAY[result.status] ?? STATUS_DISPLAY.WARN
  const statusTag = display.color(`[${result.status}]`)

  console.log(`  ${statusTag} ${chalk.white(result.ruleTitle)}`)
  console.log(chalk.dim(`    ${result.message}`))
  console.log()
}
