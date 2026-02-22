import chalk from "chalk"
import { findRulesDir, loadLocalRules } from "../lib/local-rules.js"

interface ListOptions {
  dir?: string
}

const SEVERITY_COLORS: Record<string, (text: string) => string> = {
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
}

export async function listRulesCommand(options: ListOptions): Promise<void> {
  const rulesDir = options.dir ?? findRulesDir(process.cwd())

  if (!rulesDir) {
    console.error(chalk.red("No rules directory found."))
    console.error(chalk.dim("Run 'rulebound init' to create one, or use --dir <path>."))
    process.exit(1)
  }

  const rules = loadLocalRules(rulesDir)

  if (rules.length === 0) {
    console.log(chalk.dim("No rules found."))
    return
  }

  const idWidth = 30
  const catWidth = 14
  const sevWidth = 10
  const modWidth = 8

  const header = chalk.dim(
    "ID".padEnd(idWidth) +
      "CATEGORY".padEnd(catWidth) +
      "SEVERITY".padEnd(sevWidth) +
      "MODE".padEnd(modWidth) +
      "TITLE"
  )

  console.log(header)
  console.log(chalk.dim("─".repeat(80)))

  for (const rule of rules) {
    const colorFn = SEVERITY_COLORS[rule.severity] ?? chalk.white
    const shortId = rule.id.length > idWidth - 2 ? rule.id.slice(0, idWidth - 4) + "..." : rule.id

    console.log(
      chalk.dim(shortId.padEnd(idWidth)) +
        chalk.dim(rule.category.padEnd(catWidth)) +
        colorFn(rule.severity.padEnd(sevWidth)) +
        chalk.dim(rule.modality.toUpperCase().padEnd(modWidth)) +
        chalk.white(rule.title)
    )
  }

  console.log()
  console.log(chalk.dim(`${rules.length} rule${rules.length === 1 ? "" : "s"} total from ${rulesDir}`))
}

export async function showRuleCommand(id: string, options: ListOptions): Promise<void> {
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

  const colorFn = SEVERITY_COLORS[rule.severity] ?? chalk.white

  console.log()
  console.log(chalk.white("RULE DETAIL"))
  console.log(chalk.dim("─".repeat(60)))
  console.log()
  console.log(`  ${chalk.dim("ID:")}       ${rule.id}`)
  console.log(`  ${chalk.dim("Title:")}    ${chalk.white.bold(rule.title)}`)
  console.log(`  ${chalk.dim("File:")}     ${rule.filePath}`)
  console.log(`  ${chalk.dim("Category:")} ${rule.category}`)
  console.log(`  ${chalk.dim("Severity:")} ${colorFn(rule.severity)}`)
  console.log(`  ${chalk.dim("Modality:")} ${rule.modality.toUpperCase()}`)

  if (rule.tags.length > 0) {
    console.log(`  ${chalk.dim("Tags:")}     ${rule.tags.join(", ")}`)
  }

  console.log()
  console.log(chalk.dim("CONTENT"))
  console.log(chalk.dim("─".repeat(60)))
  console.log()
  console.log(rule.content)
  console.log()
}
