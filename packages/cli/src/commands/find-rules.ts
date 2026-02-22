import chalk from "chalk"
import { findRulesDir, loadLocalRules, filterRules, type LocalRule } from "../lib/local-rules.js"
import { loadRulesWithInheritance } from "../lib/inheritance.js"

interface FindRulesOptions {
  task?: string
  title?: string
  category?: string
  tags?: string
  stack?: string
  format?: string
  dir?: string
}

const SEVERITY_COLORS: Record<string, (text: string) => string> = {
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
}

const MODALITY_LABELS: Record<string, string> = {
  must: "MUST",
  should: "SHOULD",
  may: "MAY",
}

export async function findRulesCommand(options: FindRulesOptions): Promise<void> {
  let allRules: LocalRule[]

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
  const rules = filterRules(allRules, {
    title: options.title,
    category: options.category,
    tags: options.tags,
    stack: options.stack,
    task: options.task,
  })

  if (rules.length === 0) {
    console.log(chalk.dim("No rules found matching your criteria."))
    return
  }

  // JSON output
  if (options.format === "json") {
    console.log(JSON.stringify(rules, null, 2))
    return
  }

  // Inject format — outputs rules ready to paste into agent context
  if (options.format === "inject") {
    console.log("# Active Rules")
    console.log()
    for (const rule of rules) {
      const mod = MODALITY_LABELS[rule.modality] ?? "SHOULD"
      console.log(`## [${mod}] ${rule.title}`)
      console.log()
      console.log(rule.content)
      console.log()
      console.log("---")
      console.log()
    }
    return
  }

  // Table output (default)
  console.log(chalk.white(`Found ${rules.length} rule${rules.length === 1 ? "" : "s"}:`))
  console.log()

  for (const rule of rules) {
    const colorFn = SEVERITY_COLORS[rule.severity] ?? chalk.white
    const severityBadge = colorFn(`[${rule.severity.toUpperCase()}]`)
    const modalityBadge = chalk.dim(`[${MODALITY_LABELS[rule.modality] ?? "SHOULD"}]`)

    console.log(`  ${severityBadge} ${modalityBadge} ${chalk.white.bold(rule.title)}`)
    console.log(chalk.dim(`    ${rule.filePath}`))

    if (rule.tags.length > 0) {
      console.log(chalk.dim(`    Tags: ${rule.tags.join(", ")}`))
    }

    const preview = rule.content.split("\n").find((l) => l.startsWith("- ") || (l.length > 10 && !l.startsWith("#")))
    if (preview) {
      console.log(chalk.dim(`    ${preview.trim().slice(0, 100)}${preview.length > 100 ? "..." : ""}`))
    }

    console.log()
  }
}
