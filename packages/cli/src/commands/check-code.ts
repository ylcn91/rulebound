import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import chalk from "chalk"

interface CheckCodeOptions {
  file?: string
  language?: string
  queries?: string
  dir?: string
}

export async function checkCodeCommand(options: CheckCodeOptions): Promise<void> {
  const { analyzeCode, detectLanguageFromPath, isSupportedLanguage, getBuiltinQueries, getQueryById } = await import("@rulebound/engine")
  type SupportedLanguage = import("@rulebound/engine").SupportedLanguage
  type ASTQueryDefinition = import("@rulebound/engine").ASTQueryDefinition

  if (!options.file) {
    console.error(chalk.red("--file is required. Provide a path to the source file to analyze."))
    process.exit(1)
  }

  const filePath = resolve(options.file)
  let code: string
  try {
    code = readFileSync(filePath, "utf-8")
  } catch (_error) {
    console.error(chalk.red(`Cannot read file: ${filePath}`))
    process.exit(1)
  }

  let language: SupportedLanguage | null = null

  if (options.language) {
    const lang = options.language.toLowerCase()
    if (isSupportedLanguage(lang)) {
      language = lang
    } else {
      console.error(chalk.red(`Unsupported language: ${options.language}`))
      console.error(chalk.dim("Supported: typescript, javascript, python, java, go, rust, c_sharp, cpp, ruby, bash"))
      process.exit(1)
    }
  } else {
    language = detectLanguageFromPath(filePath)
  }

  if (!language) {
    console.error(chalk.red("Cannot detect language from file extension. Use --language flag."))
    process.exit(1)
  }

  let queries: ASTQueryDefinition[] | undefined

  if (options.queries) {
    const ids = options.queries.split(",").map((s) => s.trim())
    queries = ids.map((id) => getQueryById(id)).filter((q): q is ASTQueryDefinition => q !== undefined)
    if (queries.length === 0) {
      console.error(chalk.red(`No valid query IDs found. Available: ${getBuiltinQueries(language).map((q) => q.id).join(", ")}`))
      process.exit(1)
    }
  }

  console.log()
  console.log(chalk.white.bold("AST CODE ANALYSIS"))
  console.log(chalk.dim("─".repeat(60)))
  console.log(chalk.dim(`File:     ${filePath}`))
  console.log(chalk.dim(`Language: ${language}`))

  try {
    const result = await analyzeCode(code, language, queries)

    console.log(chalk.dim(`Nodes:    ${result.nodeCount}`))
    console.log(chalk.dim(`Parse:    ${result.parseTimeMs}ms`))
    console.log(chalk.dim(`Query:    ${result.queryTimeMs}ms`))

    if (result.parseErrors > 0) {
      console.log(chalk.yellow(`Errors:   ${result.parseErrors} parse error(s)`))
    }

    console.log(chalk.dim("─".repeat(60)))
    console.log()

    if (result.matches.length === 0) {
      console.log(chalk.green("  No issues found. Code passes all AST checks."))
      console.log()
      return
    }

    const grouped = new Map<string, typeof result.matches[number][]>()
    for (const match of result.matches) {
      const existing = grouped.get(match.queryId) ?? []
      existing.push(match)
      grouped.set(match.queryId, existing)
    }

    let errorCount = 0
    let warningCount = 0
    let infoCount = 0

    for (const [queryId, matches] of grouped) {
      const first = matches[0]
      const icon = first.severity === "error"
        ? chalk.red("ERROR")
        : first.severity === "warning"
        ? chalk.yellow("WARN ")
        : chalk.blue("INFO ")

      if (first.severity === "error") errorCount += matches.length
      else if (first.severity === "warning") warningCount += matches.length
      else infoCount += matches.length

      console.log(`  ${icon} ${chalk.white.bold(first.queryName)} ${chalk.dim(`(${queryId})`)}`)
      console.log(chalk.dim(`         ${first.message}`))

      for (const m of matches) {
        const loc = `L${m.location.startRow + 1}:${m.location.startColumn + 1}`
        const preview = m.matchedText.split("\n")[0].slice(0, 60)
        console.log(`         ${chalk.cyan(loc)} ${chalk.dim(preview)}`)
      }

      if (first.suggestedFix) {
        console.log(chalk.yellow(`         Fix: ${first.suggestedFix}`))
      }

      console.log()
    }

    console.log(chalk.dim("─".repeat(60)))
    const parts: string[] = []
    if (errorCount > 0) parts.push(chalk.red(`${errorCount} error(s)`))
    if (warningCount > 0) parts.push(chalk.yellow(`${warningCount} warning(s)`))
    if (infoCount > 0) parts.push(chalk.blue(`${infoCount} info`))
    console.log(`  ${parts.join(" | ")} in ${result.matches.length} finding(s)`)
    console.log()

    if (errorCount > 0) {
      process.exit(1)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(chalk.red(`AST analysis failed: ${msg}`))
    process.exit(1)
  }
}
