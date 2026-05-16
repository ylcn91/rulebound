import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { realpathSync } from "node:fs"
import { Command } from "commander"
import { printBanner } from "./lib/banner.js"
import { findRulesCommand } from "./commands/find-rules.js"
import { validateCommand } from "./commands/validate.js"
import { listRulesCommand, newRuleCommand, showRuleCommand } from "./commands/rules.js"
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
import { checkCommand } from "./commands/check.js"
import { healCommand } from "./commands/heal.js"
import { doctorCommand } from "./commands/doctor.js"
import { packsListCommand } from "./commands/packs.js"
import { evidenceCommand } from "./commands/evidence.js"
import { adviseCommand } from "./commands/advise.js"
import {
  registrySearchCommand,
  registryInstallCommand,
  registryListCommand,
  registryInfoCommand,
} from "./commands/registry.js"
import { migrateCommand } from "./commands/migrate.js"
import { waiversListCommand } from "./commands/waivers.js"

const require = createRequire(import.meta.url)
const pkg = require("../package.json") as { version: string }

const GROUP_PRIMARY = "Primary"
const GROUP_RULES = "Rules & content"
const GROUP_DIAGNOSTICS = "Diagnostics / advisory"
const GROUP_LEGACY = "Advisory / legacy"

export function buildProgram(): Command {
  const program = new Command()

  program
    .name("rulebound")
    .description("AI coding agent rule enforcement CLI")
    .version(pkg.version)
    .configureHelp({ sortSubcommands: false })
    .addHelpText("beforeAll", () => {
      printBanner(pkg.version)
      return ""
    })
    .addHelpText(
      "after",
      "\n`rulebound check` is the canonical deterministic gate. Other commands are diagnostics, content management, or advisory/legacy.",
    )

  // ── Primary ──────────────────────────────────────────────────────────────
  program
    .command("check")
    .helpGroup(GROUP_PRIMARY)
    .description("Run deterministic rule checks (canonical command)")
    .option("-d, --dir <path>", "Path to rules directory")
    .option("-f, --format <format>", "Output: pretty, json, github, repair-json, sarif, pr-markdown", "pretty")
    .option("--diff", "Restrict diff-evidence checks to changed files (auto)")
    .option("--staged", "Use staged changes for diff context")
    .option("-b, --base <branch>", "Base branch for diff context")
    .option("--ref <ref>", "Git ref for diff context")
    .option("--rule <id>", "Run only rules whose ID matches/prefix")
    .option("--allow-commands", "Permit command/analyzer checks that exec shell")
    .option("--fail-on-advisory", "Exit non-zero (3) when advisory findings present")
    .option("--waivers <path>", "Path to waivers YAML (default: .rulebound/waivers.yaml)")
    .action(checkCommand)

  program
    .command("heal")
    .helpGroup(GROUP_PRIMARY)
    .description("Self-healing loop: run checks, optionally repair, re-run")
    .option("-d, --dir <path>", "Path to rules directory")
    .option("--max-iterations <n>", "Max iterations", "3")
    .option("--cmd <command>", "Repair command to run between iterations")
    .option("--allow-commands", "Permit command/analyzer checks")
    .option("-f, --format <format>", "Output: pretty, json", "pretty")
    .action(healCommand)

  program
    .command("doctor")
    .helpGroup(GROUP_PRIMARY)
    .description("Detect rules, config, toolchains, and analyzer availability")
    .option("-f, --format <format>", "Output: pretty, json", "pretty")
    .action(doctorCommand)

  program
    .command("evidence")
    .helpGroup(GROUP_PRIMARY)
    .description("Produce deterministic evidence report (defaults to pr-markdown). Thin wrapper over `check`.")
    .option("-d, --dir <path>", "Path to rules directory")
    .option("-f, --format <format>", "Output: pretty, json, github, sarif, pr-markdown, repair-json", "pr-markdown")
    .option("--diff", "Restrict diff-evidence checks to changed files")
    .option("--staged", "Use staged changes for diff context")
    .option("-b, --base <branch>", "Base branch for diff context")
    .option("--ref <ref>", "Git ref for diff context")
    .option("--rule <id>", "Run only rules whose ID matches/prefix")
    .option("--allow-commands", "Permit command/analyzer checks that exec shell")
    .option("--fail-on-advisory", "Exit non-zero (3) when advisory findings present")
    .option("--waivers <path>", "Path to waivers YAML (default: .rulebound/waivers.yaml)")
    .action(evidenceCommand)

  program
    .command("init")
    .helpGroup(GROUP_PRIMARY)
    .description("Initialize .rulebound/ with rules directory and config")
    .option("--examples", "Copy example rules to get started")
    .option(
      "--pack <name>",
      "Install a curated rule pack (repeatable): typescript, security, react, java-spring, go, infra, global, agent-workflow, monorepo, deterministic",
      (value: string, prev: string[] = []) => prev.concat([value]),
    )
    .option("--no-hook", "Skip pre-commit hook installation")
    .option("--migrate", "Auto-import rules from existing agent configs (CLAUDE.md, .cursorrules, etc.)")
    .action(initCommand)

  const packsCmd = program
    .command("packs")
    .helpGroup(GROUP_PRIMARY)
    .description("Curated rule packs")
  packsCmd
    .command("list")
    .description("List available rule packs and their contents")
    .option("-f, --format <format>", "Output: pretty, json", "pretty")
    .action(packsListCommand)

  // ── Rules & content ──────────────────────────────────────────────────────
  const rulesCmd = program
    .command("rules")
    .helpGroup(GROUP_RULES)
    .description("Manage rules")

  rulesCmd
    .command("new <type> <name>")
    .description("Create a deterministic rule template (regex or diff-evidence)")
    .option("-d, --dir <path>", "Path to rules directory")
    .option("-c, --category <category>", "Rule category/directory (default: general)")
    .option("--severity <severity>", "Rule severity: error, warning, info", "error")
    .option("--title <title>", "Rule title override")
    .action(newRuleCommand)

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
    .option("-f, --format <format>", "Output format: pretty, json", "pretty")
    .action(lintCommand)

  rulesCmd
    .command("history <id>")
    .description("Show version history of a rule (git-based)")
    .option("-d, --dir <path>", "Path to rules directory")
    .option("-n, --limit <number>", "Number of versions to show", "20")
    .action(historyCommand)

  program
    .command("find-rules")
    .helpGroup(GROUP_RULES)
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
    .command("generate")
    .helpGroup(GROUP_RULES)
    .description("Generate agent config files (CLAUDE.md, .cursor/rules.md, copilot-instructions.md)")
    .option("-a, --agent <agent>", "Agent type: claude-code, cursor, copilot, all (default: all)")
    .option("-t, --task <text>", "Only include rules relevant to this task")
    .option("-d, --dir <path>", "Path to rules directory")
    .option("-o, --output <path>", "Output directory (default: current dir)")
    .action(generateCommand)

  program
    .command("migrate")
    .helpGroup(GROUP_RULES)
    .description("Import rules from existing CLAUDE.md, .cursorrules, or other agent config files")
    .option("--from <file>", "Path to the file to import from")
    .option("--auto", "Auto-detect and import from all known agent config files")
    .option("--dry-run", "Show what would be created without writing files")
    .action(migrateCommand)

  const registryCmd = program
    .command("registry")
    .helpGroup(GROUP_RULES)
    .description("Search and install rule packages from npm")

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

  const bugfixCmd = program
    .command("bugfix")
    .helpGroup(GROUP_RULES)
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

  const waiversCmd = program
    .command("waivers")
    .helpGroup(GROUP_RULES)
    .description("Inspect waiver lifecycle and expiry debt")

  waiversCmd
    .command("list")
    .description("List configured waivers and expiry status")
    .option("--waivers <path>", "Path to waivers YAML (default: .rulebound/waivers.yaml)")
    .option("-f, --format <format>", "Output format: table, json", "table")
    .option("--expiring-within <days>", "Mark waivers expiring within N days", "14")
    .option("--strict", "Exit non-zero when waivers are expired or expiring")
    .action(waiversListCommand)

  const agentsCmd = program
    .command("agents")
    .helpGroup(GROUP_RULES)
    .description("Manage agent profiles")

  agentsCmd
    .command("list")
    .description("List configured agent profiles")
    .action(listAgentsCommand)

  program
    .command("score")
    .helpGroup(GROUP_RULES)
    .description("Calculate rule quality score and generate badge")
    .option("-d, --dir <path>", "Path to rules directory")
    .option("--no-badge", "Skip badge generation")
    .option("-o, --output <path>", "Save badge markdown to file")
    .action(scoreCommand)

  program
    .command("enforce")
    .helpGroup(GROUP_RULES)
    .description("View or update enforcement mode (advisory, moderate, strict)")
    .option("-m, --mode <mode>", "Set enforcement mode: advisory, moderate, strict")
    .option("-t, --threshold <number>", "Set score threshold (0-100)")
    .action(enforceCommand)

  program
    .command("hook")
    .helpGroup(GROUP_RULES)
    .description("Install/remove pre-commit git hook")
    .option("--remove", "Remove the pre-commit hook")
    .action(hookCommand)

  watchCommand.helpGroup(GROUP_RULES)
  program.addCommand(watchCommand)

  program
    .command("stats")
    .helpGroup(GROUP_RULES)
    .description("Show validation statistics and analytics")
    .option("-g, --global", "Show global stats across all projects")
    .option("--days <number>", "Number of days to include (default: 30)")
    .option("-f, --format <format>", "Output format: pretty, json")
    .action(statsCommand)

  program
    .command("check-code")
    .helpGroup(GROUP_RULES)
    .description("Analyze source file with AST-based anti-pattern detection (tree-sitter)")
    .option("--file <path>", "Path to the source file to analyze")
    .option("-l, --language <lang>", "Language override (auto-detected from extension)")
    .option("-q, --queries <ids>", "Comma-separated builtin query IDs to run")
    .action(checkCodeCommand)

  // ── Diagnostics / advisory ───────────────────────────────────────────────
  program
    .command("advise")
    .helpGroup(GROUP_DIAGNOSTICS)
    .description("Advisory plan/diff review (keyword/semantic/LLM). NOT the deterministic gate; use `check` for that.")
    .option("-p, --plan <text>", "Plan text to review")
    .option("--plan-file <path>", "Path to plan markdown file")
    .option("--diff", "Review current git diff (advisory)")
    .option("--staged", "Use staged changes")
    .option("--ref <ref>", "Git ref for diff")
    .option("--llm", "Use LLM matcher (requires AI SDK)")
    .option("-d, --dir <path>", "Path to rules directory")
    .option("-f, --format <format>", "Output: pretty, json", "pretty")
    .action(adviseCommand)

  // ── Advisory / legacy ────────────────────────────────────────────────────
  program
    .command("validate")
    .helpGroup(GROUP_LEGACY)
    .description("Advisory plan validation against matched rules")
    .option("-p, --plan <text>", "Plan text to validate")
    .option("--file <path>", "Path to plan file")
    .option("-f, --format <format>", "Output format: pretty, json")
    .option("-d, --dir <path>", "Path to rules directory")
    .option("--llm", "Use LLM for deep validation (requires AI SDK)")
    .action(validateCommand)

  program
    .command("diff")
    .helpGroup(GROUP_LEGACY)
    .description("Advisory git diff validation against matched rules")
    .option("--ref <ref>", "Git ref to diff against (default: HEAD)")
    .option("--staged", "Validate staged changes only")
    .option("-f, --format <format>", "Output format: pretty, json")
    .option("-d, --dir <path>", "Path to rules directory")
    .option("--llm", "Use LLM for deep validation (requires AI SDK)")
    .action(diffCommand)

  program
    .command("ci")
    .helpGroup(GROUP_LEGACY)
    .description("Legacy advisory PR validation; prefer `rulebound check --format github`")
    .option("-b, --base <branch>", "Base branch to diff against (default: main)")
    .option("-f, --format <format>", "Output: pretty, json, github")
    .option("--llm", "Use LLM for deep validation")
    .option("-d, --dir <path>", "Path to rules directory")
    .action(ciCommand)

  program
    .command("review")
    .helpGroup(GROUP_LEGACY)
    .description("Advisory multi-agent review with consensus; not the deterministic gate")
    .option("-a, --agents <agents>", "Comma-separated agent names")
    .option("-p, --plan <text>", "Plan text to review")
    .option("--diff", "Review current git diff")
    .option("--llm", "Use LLM for deep validation")
    .option("-d, --dir <path>", "Path to rules directory")
    .action(reviewCommand)

  return program
}

// Only auto-parse when invoked as the CLI entry point. This lets test code
// import `buildProgram` without triggering `program.parse(process.argv)`.
function isEntryPoint(): boolean {
  if (!process.argv[1]) return false
  try {
    const here = fileURLToPath(import.meta.url)
    return realpathSync(process.argv[1]) === realpathSync(here)
  } catch {
    return false
  }
}

if (isEntryPoint()) {
  buildProgram().parse()
}
