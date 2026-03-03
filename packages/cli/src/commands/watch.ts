import { watch, type FSWatcher } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve, relative } from "node:path"
import { Command } from "commander"
import chalk from "chalk"
import {
  type ASTViolation,
  type RuleViolation,
  shouldIgnore,
  formatPrettyAST,
  formatPrettyRule,
  formatJsonAST,
  formatJsonRule,
  createDebouncer,
  writeOutput,
} from "../lib/watch-format.js"

const DEFAULT_IGNORE = ["node_modules", ".git", "dist", ".next", "coverage"]

interface WatchOptions {
  readonly debounce: string
  readonly format: string
  readonly ignore: readonly string[]
}

async function processFile(
  filePath: string,
  dir: string,
  format: string,
): Promise<void> {
  const {
    analyzeCode,
    detectLanguageFromPath,
    isSupportedLanguage,
    getBuiltinQueries,
    validate,
    findRulesDir,
    loadLocalRules,
  } = await import("@rulebound/engine")

  const language = detectLanguageFromPath(filePath)
  if (!language || !isSupportedLanguage(language)) {
    return
  }

  let code: string
  try {
    code = await readFile(filePath, "utf-8")
  } catch {
    writeOutput(chalk.red(`Failed to read: ${filePath}`))
    return
  }

  const relPath = relative(dir, filePath)

  await runASTAnalysis(code, language, relPath, format, getBuiltinQueries, analyzeCode)
  await runRuleValidation(code, relPath, dir, format, findRulesDir, loadLocalRules, validate)
}

async function runASTAnalysis(
  code: string,
  language: string,
  relPath: string,
  format: string,
  getBuiltinQueries: typeof import("@rulebound/engine").getBuiltinQueries,
  analyzeCode: typeof import("@rulebound/engine").analyzeCode,
): Promise<void> {
  try {
    const queries = getBuiltinQueries(language as import("@rulebound/engine").SupportedLanguage)
      .filter((q) => q.language === language)

    if (queries.length === 0) {
      return
    }

    const result = await analyzeCode(code, language as import("@rulebound/engine").SupportedLanguage, queries)

    for (const match of result.matches) {
      const violation: ASTViolation = {
        file: relPath,
        line: match.location.startRow + 1,
        rule: match.queryId,
        severity: match.severity,
        message: match.queryName,
      }

      writeOutput(format === "json" ? formatJsonAST(violation) : formatPrettyAST(violation))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    writeOutput(chalk.red(`AST analysis failed for ${relPath}: ${msg}`))
  }
}

async function runRuleValidation(
  code: string,
  relPath: string,
  dir: string,
  format: string,
  findRulesDir: typeof import("@rulebound/engine").findRulesDir,
  loadLocalRules: typeof import("@rulebound/engine").loadLocalRules,
  validate: typeof import("@rulebound/engine").validate,
): Promise<void> {
  try {
    const rulesDir = findRulesDir(dir)
    if (!rulesDir) {
      return
    }

    const rules = loadLocalRules(rulesDir)
    if (rules.length === 0) {
      return
    }

    const report = await validate({ plan: code, rules })

    for (const result of report.results) {
      if (result.status === "PASS") {
        continue
      }

      const violation: RuleViolation = {
        file: relPath,
        rule: result.ruleTitle,
        severity: result.status === "VIOLATED" ? result.severity : "info",
        message: result.reason,
        status: result.status,
      }

      writeOutput(format === "json" ? formatJsonRule(violation) : formatPrettyRule(violation))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    writeOutput(chalk.red(`Rule validation failed for ${relPath}: ${msg}`))
  }
}

export const watchCommand = new Command("watch")
  .description("Watch files for changes and run real-time rule validation")
  .argument("[dir]", "Directory to watch", ".")
  .option("--debounce <ms>", "Debounce interval in milliseconds", "300")
  .option("--format <type>", "Output format: pretty | json", "pretty")
  .option("--ignore <glob>", "Glob patterns to ignore (repeatable)", collect, DEFAULT_IGNORE)
  .action(async (dir: string, options: WatchOptions) => {
    const resolvedDir = resolve(dir)
    const debounceMs = parseInt(options.debounce, 10)
    const format = options.format
    const ignorePatterns = options.ignore

    writeOutput(
      chalk.cyan(`Watching ${resolvedDir} for changes (debounce: ${debounceMs}ms)...`),
    )

    const debounce = createDebouncer(debounceMs)
    let watcher: FSWatcher

    try {
      watcher = watch(resolvedDir, { recursive: true }, (_event, filename) => {
        if (!filename) {
          return
        }

        const fullPath = resolve(resolvedDir, filename)

        if (shouldIgnore(filename, ignorePatterns)) {
          return
        }

        debounce(fullPath, () => {
          processFile(fullPath, resolvedDir, format).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err)
            writeOutput(chalk.red(`Error processing ${filename}: ${msg}`))
          })
        })
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      writeOutput(chalk.red(`Failed to start watcher: ${msg}`))
      process.exit(1)
    }

    process.on("SIGINT", () => {
      watcher.close()
      writeOutput(chalk.dim("\nWatcher stopped."))
      process.exit(0)
    })
  })

function collect(value: string, previous: readonly string[]): readonly string[] {
  return [...previous, value]
}
