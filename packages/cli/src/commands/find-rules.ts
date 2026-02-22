import chalk from "chalk"
import ora from "ora"
import type { RuleCategory } from "@rulebound/shared"
import { findRules } from "../lib/api.js"

interface FindRulesOptions {
  title?: string
  category?: string
  tags?: string
  format?: string
}

const SEVERITY_COLORS: Record<string, (text: string) => string> = {
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
}

export async function findRulesCommand(
  options: FindRulesOptions
): Promise<void> {
  const spinner = ora("Searching rules...").start()

  const result = await findRules({
    title: options.title,
    category: options.category as RuleCategory | undefined,
    tags: options.tags,
  })

  spinner.stop()

  if (!result.success || !result.data) {
    console.error(chalk.red(`Error: ${result.error ?? "Failed to fetch rules"}`))
    process.exit(1)
  }

  const rules = result.data

  if (rules.length === 0) {
    console.log(chalk.dim("No rules found matching your criteria."))
    return
  }

  if (options.format === "json") {
    console.log(JSON.stringify(rules, null, 2))
    return
  }

  console.log(
    chalk.blue(`Found ${rules.length} rule${rules.length === 1 ? "" : "s"}:`)
  )
  console.log()

  for (const rule of rules) {
    const colorFn = SEVERITY_COLORS[rule.severity] ?? chalk.white
    const severityBadge = colorFn(`[${rule.severity.toUpperCase()}]`)
    const categoryBadge = chalk.dim(`[${rule.category}]`)

    console.log(`  ${severityBadge} ${categoryBadge} ${chalk.white.bold(rule.title)}`)
    console.log(chalk.dim(`    ID: ${rule.id}`))

    if (rule.tags.length > 0) {
      console.log(chalk.dim(`    Tags: ${rule.tags.join(", ")}`))
    }

    const preview = rule.content.slice(0, 120).replace(/\n/g, " ")
    console.log(chalk.dim(`    ${preview}${rule.content.length > 120 ? "..." : ""}`))
    console.log()
  }
}
