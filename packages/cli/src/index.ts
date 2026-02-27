import { createRequire } from "node:module"
import { Command } from "commander"
import { printBanner } from "./lib/banner.js"
import { findRulesCommand } from "./commands/find-rules.js"
import { validateCommand } from "./commands/validate.js"
import { listRulesCommand, showRuleCommand } from "./commands/rules.js"
import { initCommand } from "./commands/init.js"
import { lintCommand } from "./commands/lint.js"
import { historyCommand } from "./commands/history.js"
import { generateCommand } from "./commands/generate.js"
import { diffCommand } from "./commands/diff.js"
import { scoreCommand } from "./commands/score.js"
import { hookCommand } from "./commands/hook.js"
import { enforceCommand } from "./commands/enforce.js"

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
  .description("Initialize .rulebound/ with rules directory and config")
  .option("--examples", "Copy example rules to get started")
  .action(initCommand)

program
  .command("find-rules")
  .description("Find and inject relevant rules for a task")
  .option("-t, --task <text>", "Describe the task to find relevant rules")
  .option("--title <title>", "Search by title")
  .option("-c, --category <category>", "Filter by category")
  .option("--tags <tags>", "Filter by tags (comma-separated)")
  .option("--stack <stack>", "Filter by tech stack (comma-separated)")
  .option("-f, --format <format>", "Output format: table, json, inject")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(findRulesCommand)

program
  .command("validate")
  .description("Validate an implementation plan against matched rules")
  .option("-p, --plan <text>", "Plan text to validate")
  .option("--file <path>", "Path to plan file")
  .option("-f, --format <format>", "Output format: pretty, json")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(validateCommand)

program
  .command("generate")
  .description("Generate agent config files (CLAUDE.md, .cursor/rules.md, copilot-instructions.md)")
  .option("-a, --agent <agent>", "Agent type: claude-code, cursor, copilot, all (default: all)")
  .option("-t, --task <text>", "Only include rules relevant to this task")
  .option("-d, --dir <path>", "Path to rules directory")
  .option("-o, --output <path>", "Output directory (default: current dir)")
  .action(generateCommand)

program
  .command("diff")
  .description("Validate git diff against rules before merge")
  .option("--ref <ref>", "Git ref to diff against (default: HEAD)")
  .option("-f, --format <format>", "Output format: pretty, json")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(diffCommand)

program
  .command("score")
  .description("Calculate rule quality score and generate badge")
  .option("-d, --dir <path>", "Path to rules directory")
  .option("--no-badge", "Skip badge generation")
  .option("-o, --output <path>", "Save badge markdown to file")
  .action(scoreCommand)

program
  .command("hook")
  .description("Install/remove pre-commit git hook")
  .option("--remove", "Remove the pre-commit hook")
  .action(hookCommand)

program
  .command("enforce")
  .description("View or update enforcement mode (advisory, moderate, strict)")
  .option("-m, --mode <mode>", "Set enforcement mode: advisory, moderate, strict")
  .option("-t, --threshold <number>", "Set score threshold (0-100)")
  .action(enforceCommand)

const rulesCmd = program.command("rules").description("Manage rules")

rulesCmd
  .command("list")
  .description("List all rules with metadata")
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
