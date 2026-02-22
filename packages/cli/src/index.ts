import { createRequire } from "node:module"
import { Command } from "commander"
import { printBanner } from "./lib/banner.js"
import { loginCommand } from "./commands/login.js"
import { setupCommand } from "./commands/setup.js"
import { findRulesCommand } from "./commands/find-rules.js"
import { validateCommand } from "./commands/validate.js"
import { listRulesCommand, showRuleCommand } from "./commands/rules.js"

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
  .command("login")
  .description("Authenticate with the Rulebound server")
  .action(loginCommand)

program
  .command("setup")
  .description("Initialize Rulebound in the current project")
  .action(setupCommand)

program
  .command("find-rules")
  .description("Search for rules matching criteria")
  .option("-t, --title <title>", "Search by title")
  .option("-c, --category <category>", "Filter by category")
  .option("--tags <tags>", "Filter by tags (comma-separated)")
  .option("-f, --format <format>", "Output format (json)")
  .action(findRulesCommand)

program
  .command("validate")
  .description("Validate a plan against rules")
  .option("-p, --plan <text>", "Plan text to validate")
  .option("--file <path>", "Path to plan file")
  .action(validateCommand)

const rulesCmd = program
  .command("rules")
  .description("Manage rules")

rulesCmd
  .command("list")
  .description("List all rules")
  .action(listRulesCommand)

rulesCmd
  .command("show <id>")
  .description("Show full detail of a rule")
  .action(showRuleCommand)

program.parse()
