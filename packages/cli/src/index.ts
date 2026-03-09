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
import { ciCommand } from "./commands/ci.js"
import { listAgentsCommand } from "./commands/agents.js"
import { reviewCommand } from "./commands/review.js"
import { checkCodeCommand } from "./commands/check-code.js"
import { watchCommand } from "./commands/watch.js"
import { statsCommand } from "./commands/stats.js"
import { bugfixCommand, validateBugfixCommand } from "./commands/bugfix.js"
import {
  registrySearchCommand,
  registryInstallCommand,
  registryListCommand,
  registryInfoCommand,
} from "./commands/registry.js"
import { migrateCommand } from "./commands/migrate.js"

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
  .option("--no-hook", "Skip pre-commit hook installation")
  .option("--migrate", "Auto-import rules from existing agent configs (CLAUDE.md, .cursorrules, etc.)")
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
  .option("--llm", "Use LLM for deep validation (requires AI SDK)")
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
  .option("--staged", "Validate staged changes only")
  .option("-f, --format <format>", "Output format: pretty, json")
  .option("-d, --dir <path>", "Path to rules directory")
  .option("--llm", "Use LLM for deep validation (requires AI SDK)")
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

program
  .command("ci")
  .description("Validate PR changes in CI/CD pipeline")
  .option("-b, --base <branch>", "Base branch to diff against (default: main)")
  .option("-f, --format <format>", "Output: pretty, json, github")
  .option("--llm", "Use LLM for deep validation")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(ciCommand)

const agentsCmd = program.command("agents").description("Manage agent profiles")

agentsCmd
  .command("list")
  .description("List configured agent profiles")
  .action(listAgentsCommand)

program
  .command("review")
  .description("Multi-agent review with consensus")
  .option("-a, --agents <agents>", "Comma-separated agent names")
  .option("-p, --plan <text>", "Plan text to review")
  .option("--diff", "Review current git diff")
  .option("--llm", "Use LLM for deep validation")
  .option("-d, --dir <path>", "Path to rules directory")
  .action(reviewCommand)

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

program
  .command("check-code")
  .description("Analyze source file with AST-based anti-pattern detection (tree-sitter)")
  .option("--file <path>", "Path to the source file to analyze")
  .option("-l, --language <lang>", "Language override (auto-detected from extension)")
  .option("-q, --queries <ids>", "Comma-separated builtin query IDs to run")
  .action(checkCodeCommand)

program.addCommand(watchCommand)

program
  .command("stats")
  .description("Show validation statistics and analytics")
  .option("-g, --global", "Show global stats across all projects")
  .option("--days <number>", "Number of days to include (default: 30)")
  .option("-f, --format <format>", "Output format: pretty, json")
  .action(statsCommand)

const registryCmd = program.command("registry").description("Search and install rule packages from npm")

registryCmd
  .command("search [query]")
  .description("Search npm for rulebound rule packages")
  .action(registrySearchCommand)

registryCmd
  .command("install <package>")
  .description("Install a rule package and add to config extends")
  .action(registryInstallCommand)

registryCmd
  .command("list")
  .description("List installed rule packages")
  .action(registryListCommand)

registryCmd
  .command("info <package>")
  .description("Show details of an installed rule package")
  .action(registryInfoCommand)

program
  .command("migrate")
  .description("Import rules from existing CLAUDE.md, .cursorrules, or other agent config files")
  .option("--from <file>", "Path to the file to import from")
  .option("--auto", "Auto-detect and import from all known agent config files")
  .option("--dry-run", "Show what would be created without writing files")
  .action(migrateCommand)

const bugfixCmd = program
  .command("bugfix")
  .description("Create and validate a bugfix boundary spec")

bugfixCmd
  .option("-s, --summary <text>", "Bug summary")
  .option("--title <title>", "Bugfix title")
  .option("--condition <text>", "Explicit bug condition C")
  .option("--postcondition <text>", "Explicit postcondition P")
  .option("--preserve <items>", "Comma-separated preservation scenarios")
  .option("--root-cause <text>", "Root cause hypothesis")
  .option("--scope <items>", "Comma-separated files or paths in scope")
  .option("--out-of-scope <items>", "Comma-separated files or paths explicitly out of scope")
  .option("-o, --output <path>", "Output file or directory (default: .rulebound/bugfixes/<slug>.md)")
  .option("-f, --format <format>", "Output format: pretty, json")
  .option("--force", "Overwrite an existing spec file")
  .action(bugfixCommand)

bugfixCmd
  .command("validate")
  .description("Validate a bugfix spec and optional plan before coding")
  .option("--file <path>", "Bugfix spec path (defaults to the latest .rulebound/bugfixes/*.md)")
  .option("--plan <text>", "Plan markdown to validate")
  .option("--plan-file <path>", "Path to plan markdown file")
  .option("-f, --format <format>", "Output format: pretty, json")
  .action(validateBugfixCommand)

program.parse()
