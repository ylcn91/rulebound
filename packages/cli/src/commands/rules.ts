import chalk from "chalk"
import ora from "ora"
import { listRules, getRule } from "../lib/api.js"

const SEVERITY_COLORS: Record<string, (text: string) => string> = {
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
}

export async function listRulesCommand(): Promise<void> {
  const spinner = ora("Fetching rules...").start()

  const result = await listRules()

  spinner.stop()

  if (!result.success || !result.data) {
    console.error(chalk.red(`Error: ${result.error ?? "Failed to fetch rules"}`))
    process.exit(1)
  }

  const rules = result.data

  if (rules.length === 0) {
    console.log(chalk.dim("No rules found."))
    return
  }

  const idWidth = 8
  const titleWidth = 35
  const catWidth = 14
  const sevWidth = 10

  const header =
    chalk.dim(
      "ID".padEnd(idWidth) +
        "TITLE".padEnd(titleWidth) +
        "CATEGORY".padEnd(catWidth) +
        "SEVERITY".padEnd(sevWidth) +
        "ACTIVE"
    )

  console.log(header)
  console.log(chalk.dim("─".repeat(idWidth + titleWidth + catWidth + sevWidth + 6)))

  for (const rule of rules) {
    const colorFn = SEVERITY_COLORS[rule.severity] ?? chalk.white
    const shortId = rule.id.slice(0, 8)
    const title =
      rule.title.length > titleWidth - 2
        ? rule.title.slice(0, titleWidth - 4) + "..."
        : rule.title
    const active = rule.isActive ? chalk.green("yes") : chalk.dim("no")

    console.log(
      chalk.dim(shortId.padEnd(idWidth)) +
        chalk.white(title.padEnd(titleWidth)) +
        chalk.dim(rule.category.padEnd(catWidth)) +
        colorFn(rule.severity.padEnd(sevWidth)) +
        active
    )
  }

  console.log()
  console.log(chalk.dim(`${rules.length} rule${rules.length === 1 ? "" : "s"} total`))
}

export async function showRuleCommand(id: string): Promise<void> {
  const spinner = ora("Fetching rule...").start()

  const result = await getRule(id)

  spinner.stop()

  if (!result.success || !result.data) {
    console.error(chalk.red(`Error: ${result.error ?? "Rule not found"}`))
    process.exit(1)
  }

  const rule = result.data
  const colorFn = SEVERITY_COLORS[rule.severity] ?? chalk.white

  console.log(chalk.blue("RULE DETAIL"))
  console.log(chalk.dim("─".repeat(50)))
  console.log()
  console.log(`  ${chalk.dim("ID:")}       ${rule.id}`)
  console.log(`  ${chalk.dim("Title:")}    ${chalk.white.bold(rule.title)}`)
  console.log(`  ${chalk.dim("Category:")} ${rule.category}`)
  console.log(`  ${chalk.dim("Severity:")} ${colorFn(rule.severity)}`)
  console.log(`  ${chalk.dim("Active:")}   ${rule.isActive ? chalk.green("yes") : chalk.dim("no")}`)
  console.log(`  ${chalk.dim("Version:")}  ${rule.version}`)

  if (rule.tags.length > 0) {
    console.log(`  ${chalk.dim("Tags:")}     ${rule.tags.join(", ")}`)
  }

  console.log()
  console.log(chalk.dim("CONTENT"))
  console.log(chalk.dim("─".repeat(50)))
  console.log()
  console.log(rule.content)
  console.log()
}
