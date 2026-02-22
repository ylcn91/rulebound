import { createRequire } from "node:module"
import { Command } from "commander"
import { printBanner } from "./lib/banner.js"
import { findRulesCommand } from "./commands/find-rules.js"
import { validateCommand } from "./commands/validate.js"
import { listRulesCommand, showRuleCommand } from "./commands/rules.js"
import { initCommand } from "./commands/init.js"
import { lintCommand } from "./commands/lint.js"
import { historyCommand } from "./commands/history.js"

const require = createRequire(import.meta.url)
const pkg = require("../package.json") as { version: string }

const program = new Command()

program
  .name("rulebound")
  .description("AI coding agent rule enforcement CLI")
  .version(pkg.version)
  .addHelpText("beforeAll", () => {
    printBanner(pkg.version)
    return ""
  })

program
  .command("init")
  .description("Initialize a .rulebound/rules/ directory with example rules")
  .option("--examples", "Copy example rules to get started")
  .action(initCommand)

program
  .command("find-rules")
  .description("Find rules matching a task or criteria")
  .option("-t, --task <text>", "Describe the task to find relevant rules")
  .option("--title <title>", "Search by title")
  .option("-c, --category <category>", "Filter by category")
  .option("--tags <tags>", "Filter by tags (comma-separated)")
  .option("-f, --format <format>", "Output format (table, json, inject)")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(findRulesCommand)

program
  .command("validate")
  .description("Validate a task plan against rules")
  .option("-p, --plan <text>", "Plan text to validate")
  .option("--file <path>", "Path to plan file")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(validateCommand)

const rulesCmd = program.command("rules").description("Manage rules")

rulesCmd
  .command("list")
  .description("List all rules")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(listRulesCommand)

rulesCmd
  .command("show <id>")
  .description("Show full detail of a rule")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(showRuleCommand)

rulesCmd
  .command("lint")
  .description("Score rules on quality attributes (Atomicity, Completeness, Clarity)")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(lintCommand)

rulesCmd
  .command("history <id>")
  .description("Show version history of a rule (git-based)")
  .option("-d, --dir <path>", "Path to rules directory")
  .option("-n, --limit <number>", "Number of versions to show", "20")
  .action(historyCommand)

program.parse()
