import chalk from "chalk"
import { findRulesDir, loadLocalRules, type LocalRule } from "../lib/local-rules.js"
import { loadRulesWithInheritance } from "../lib/inheritance.js"

interface ListOptions {
  dir?: string
}

interface ShowOptions {
  dir?: string
}

const MODALITY_LABELS: Record<string, string> = {
  must: "MUST",
  should: "SHOULD",
  may: "MAY",
}

export async function listRulesCommand(options: ListOptions): Promise<void> {
  let rules: LocalRule[]

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

  // Header
  const cols = {
    id: 30,
    category: 14,
    severity: 10,
    mode: 8,
    stack: 20,
    title: 30,
  }

  console.log(
    chalk.dim(
      `${"ID".padEnd(cols.id)}${"CATEGORY".padEnd(cols.category)}${"SEVERITY".padEnd(cols.severity)}${"MODE".padEnd(cols.mode)}${"STACK".padEnd(cols.stack)}TITLE`
    )
  )
  console.log(chalk.dim("\u2500".repeat(112)))

  for (const rule of rules) {
    const id = rule.id.length > cols.id - 1 ? rule.id.slice(0, cols.id - 4) + "..." : rule.id
    const mode = MODALITY_LABELS[rule.modality] ?? "SHOULD"
    const stack = rule.stack.length > 0 ? rule.stack.join(", ") : chalk.dim("global")
    const stackStr = stack.length > cols.stack - 1 ? stack.slice(0, cols.stack - 4) + "..." : stack

    console.log(
      `${id.padEnd(cols.id)}${rule.category.padEnd(cols.category)}${rule.severity.padEnd(cols.severity)}${mode.padEnd(cols.mode)}${stackStr.padEnd(cols.stack)}${rule.title}`
    )
  }

  const rulesDir = options.dir ?? findRulesDir(process.cwd()) ?? ".rulebound/rules"
  console.log()
  console.log(chalk.dim(`${rules.length} rules total from ${rulesDir}`))
}

export async function showRuleCommand(id: string, options: ShowOptions): Promise<void> {
  let rules: LocalRule[]

  if (options.dir) {
    rules = loadLocalRules(options.dir)
  } else {
    rules = loadRulesWithInheritance(process.cwd())
  }

  const rule = rules.find((r) => r.id === id)

  if (!rule) {
    console.error(chalk.red(`Rule not found: ${id}`))
    console.error(chalk.dim("Use 'rulebound rules list' to see available rules."))
    process.exit(1)
  }

  console.log()
  console.log(chalk.white("RULE DETAIL"))
  console.log(chalk.dim("\u2500".repeat(60)))
  console.log()
  console.log(`  ${chalk.dim("ID:")}       ${rule.id}`)
  console.log(`  ${chalk.dim("Title:")}    ${rule.title}`)
  console.log(`  ${chalk.dim("File:")}     ${rule.filePath}`)
  console.log(`  ${chalk.dim("Category:")} ${rule.category}`)
  console.log(`  ${chalk.dim("Severity:")} ${rule.severity}`)
  console.log(`  ${chalk.dim("Modality:")} ${MODALITY_LABELS[rule.modality] ?? rule.modality}`)
  console.log(`  ${chalk.dim("Tags:")}     ${rule.tags.join(", ") || chalk.dim("none")}`)
  console.log(`  ${chalk.dim("Stack:")}    ${rule.stack.join(", ") || chalk.dim("global")}`)
  console.log(`  ${chalk.dim("Scope:")}    ${rule.scope.join(", ") || chalk.dim("all")}`)
  if (rule.team.length > 0) {
    console.log(`  ${chalk.dim("Team:")}     ${rule.team.join(", ")}`)
  }
  console.log()
  console.log(chalk.white("CONTENT"))
  console.log(chalk.dim("\u2500".repeat(60)))
  console.log()
  console.log(rule.content)
}
