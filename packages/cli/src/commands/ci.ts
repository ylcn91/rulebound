import { execFileSync } from "node:child_process"
import chalk from "chalk"
import {
  loadLocalRules,
  matchRulesByContext,
} from "../lib/local-rules.js"
import { validateWithPipeline } from "../lib/validation.js"
import type { ValidationResult, ValidationReport } from "../lib/local-rules.js"
import { loadRulesWithInheritance, getProjectConfig, loadConfig } from "../lib/inheritance.js"
import { shouldBlock, DEFAULT_ENFORCEMENT, type EnforcementConfig } from "../lib/enforcement.js"

interface CiOptions {
  readonly base?: string
  readonly format?: string
  readonly llm?: boolean
  readonly dir?: string
}

/**
 * Format a validation result as a GitHub Actions annotation.
 *
 * - PASS returns empty string (no annotation needed)
 * - VIOLATED returns ::error:: with MUST violation prefix
 * - NOT_COVERED returns ::warning:: with modality prefix
 */
export function formatGitHubAnnotation(result: ValidationResult): string {
  if (result.status === "PASS") {
    return ""
  }

  if (result.status === "VIOLATED") {
    return `::error::${result.modality.toUpperCase()} violation: ${result.ruleTitle} - ${result.reason}`
  }

  // NOT_COVERED
  const modality = result.modality.toUpperCase()
  return `::warning::${modality}: ${result.ruleTitle} - ${result.reason}`
}

const SAFE_REF_PATTERN = /^[a-zA-Z0-9._\-/]+$/

function getDiff(base: string): string {
  if (!SAFE_REF_PATTERN.test(base)) {
    throw new Error(`Invalid base ref: "${base}". Only alphanumeric, '.', '_', '-', '/' allowed.`)
  }

  try {
    return execFileSync("git", ["diff", `origin/${base}...HEAD`], { encoding: "utf-8" })
  } catch {
    try {
      return execFileSync("git", ["diff", `${base}...HEAD`], { encoding: "utf-8" })
    } catch {
      throw new Error(`Failed to get git diff against base "${base}". Are you in a git repository?`)
    }
  }
}

function extractAddedLines(diffText: string): string {
  return diffText
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1))
    .join("\n")
}

function extractChangedFiles(diffText: string): string[] {
  return diffText
    .split("\n")
    .filter((l) => l.startsWith("+++ b/"))
    .map((l) => l.replace(/^\+\+\+ b\//, ""))
}

function loadEnforcementConfig(cwd: string): EnforcementConfig {
  const config = loadConfig(cwd)
  if (!config) return DEFAULT_ENFORCEMENT

  const raw = (config as Record<string, unknown>).enforcement as Partial<EnforcementConfig> | undefined
  if (!raw) return DEFAULT_ENFORCEMENT

  return {
    mode: raw.mode ?? DEFAULT_ENFORCEMENT.mode,
    scoreThreshold: raw.scoreThreshold ?? DEFAULT_ENFORCEMENT.scoreThreshold,
    autoPromote: raw.autoPromote ?? DEFAULT_ENFORCEMENT.autoPromote,
  }
}

function calculateScore(report: ValidationReport): number {
  const total = report.results.length
  if (total === 0) return 100

  const passWeight = 1
  const notCoveredWeight = 0.5
  const violatedWeight = 0

  const weighted =
    report.summary.pass * passWeight +
    report.summary.notCovered * notCoveredWeight +
    report.summary.violated * violatedWeight

  return Math.round((weighted / total) * 100)
}

function formatPrettyOutput(report: ValidationReport, filesChanged: string[], score: number): void {
  console.log()
  console.log(chalk.white.bold("CI VALIDATION"))
  console.log(chalk.dim(`Files changed: ${filesChanged.length}`))

  if (filesChanged.length > 0) {
    for (const f of filesChanged.slice(0, 10)) {
      console.log(chalk.dim(`  ${f}`))
    }
    if (filesChanged.length > 10) {
      console.log(chalk.dim(`  ... and ${filesChanged.length - 10} more`))
    }
  }

  console.log(chalk.dim("\u2500".repeat(50)))
  console.log()

  const actionable = report.results.filter((r) => r.status !== "PASS")

  if (actionable.length === 0) {
    console.log(chalk.green("  All changes comply with matched rules."))
    console.log()
    console.log(chalk.dim(`  ${report.results.length} rules checked, all passed.`))
    console.log(chalk.dim(`  Score: ${score}/100`))
    console.log()
    return
  }

  for (const item of actionable) {
    const icon = item.status === "VIOLATED" ? chalk.red("\u2717") : chalk.yellow("\u25CB")
    const statusTag =
      item.status === "VIOLATED" ? chalk.red("[VIOLATED]") : chalk.yellow("[NOT COVERED]")
    const modTag = chalk.dim(`${item.modality.toUpperCase()}:`)

    console.log(`  ${icon} ${statusTag} ${modTag} ${chalk.white.bold(item.ruleTitle)}`)
    console.log(chalk.dim(`    ${item.reason}`))
    if (item.suggestedFix) {
      console.log(chalk.yellow(`    \u2192 ${item.suggestedFix}`))
    }
    console.log()
  }

  console.log(chalk.dim("\u2500".repeat(50)))
  console.log(
    `  ${chalk.green(`${report.summary.pass} PASS`)} | ` +
    `${chalk.red(`${report.summary.violated} VIOLATED`)} | ` +
    `${chalk.yellow(`${report.summary.notCovered} NOT COVERED`)}`
  )
  console.log(chalk.dim(`  Score: ${score}/100`))
  console.log()
}

function formatGitHubOutput(report: ValidationReport, score: number): void {
  for (const result of report.results) {
    const annotation = formatGitHubAnnotation(result)
    if (annotation) {
      console.log(annotation)
    }
  }

  // Write summary for GitHub Actions
  console.log()
  console.log(
    `::notice::Rulebound CI: ${report.summary.pass} passed, ` +
    `${report.summary.violated} violated, ` +
    `${report.summary.notCovered} not covered. Score: ${score}/100`
  )
}

function formatJsonOutput(
  report: ValidationReport,
  filesChanged: string[],
  score: number,
  blocked: boolean
): void {
  console.log(
    JSON.stringify(
      {
        ...report,
        filesChanged,
        score,
        blocked,
      },
      null,
      2
    )
  )
}

export async function ciCommand(options: CiOptions): Promise<void> {
  const cwd = process.cwd()
  const base = options.base ?? "main"
  const format = options.format ?? "pretty"

  // Get diff
  let diffText: string
  try {
    diffText = getDiff(base)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(chalk.red(message))
    process.exit(2)
  }

  if (!diffText.trim()) {
    if (format === "json") {
      console.log(JSON.stringify({ status: "PASSED", message: "No changes detected" }))
    } else if (format === "github") {
      console.log("::notice::Rulebound CI: No changes detected")
    } else {
      console.log(chalk.dim("No changes detected."))
    }
    process.exit(0)
  }

  // Load rules
  let allRules
  try {
    if (options.dir) {
      allRules = loadLocalRules(options.dir)
    } else {
      allRules = loadRulesWithInheritance(cwd)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(chalk.red(`Failed to load rules: ${message}`))
    process.exit(2)
  }

  if (allRules.length === 0) {
    if (format === "json") {
      console.log(JSON.stringify({ status: "PASSED", message: "No rules found" }))
    } else if (format === "github") {
      console.log("::warning::Rulebound CI: No rules found. Run 'rulebound init' to set up.")
    } else {
      console.error(chalk.red("No rules found. Run 'rulebound init' to set up."))
    }
    process.exit(2)
  }

  // Extract context from diff
  const addedLines = extractAddedLines(diffText)
  const filesChanged = extractChangedFiles(diffText)

  // Smart context matching
  const projectConfig = getProjectConfig(cwd)
  const rules = matchRulesByContext(allRules, projectConfig, addedLines.slice(0, 2000))

  if (rules.length === 0) {
    if (format === "json") {
      console.log(JSON.stringify({ status: "PASSED", message: "No rules matched the changes" }))
    } else if (format === "github") {
      console.log("::notice::Rulebound CI: No rules matched the changes")
    } else {
      console.log(chalk.dim("No rules matched the changes."))
    }
    process.exit(0)
  }

  // Validate using the full pipeline (keyword + semantic + optional LLM)
  const report = await validateWithPipeline({
    plan: addedLines,
    rules,
    task: `CI diff against ${base}`,
    useLlm: options.llm,
  })

  // Calculate score and enforcement
  const score = calculateScore(report)
  const enforcement = loadEnforcementConfig(cwd)
  const hasMustViolation = report.results.some(
    (r) => r.status === "VIOLATED" && r.modality === "must"
  )
  const hasShouldViolation = report.results.some(
    (r) => r.status === "VIOLATED" && r.modality === "should"
  )
  const blocked = shouldBlock(enforcement, { hasMustViolation, hasShouldViolation, score })

  // Output
  switch (format) {
    case "github":
      formatGitHubOutput(report, score)
      break
    case "json":
      formatJsonOutput(report, filesChanged, score, blocked)
      break
    default:
      formatPrettyOutput(report, filesChanged, score)
      break
  }

  // Exit code
  if (blocked) {
    if (format === "pretty") {
      console.log(chalk.red.bold(`BLOCKED by enforcement (mode: ${enforcement.mode}, threshold: ${enforcement.scoreThreshold})`))
      console.log()
    }
    process.exit(1)
  }

  if (report.status === "FAILED") {
    if (format === "pretty") {
      console.log(chalk.red.bold("FAILED \u2014 MUST violations detected"))
      console.log()
    }
    process.exit(1)
  }

  if (format === "pretty" && report.status === "PASSED_WITH_WARNINGS") {
    console.log(chalk.yellow("PASSED with warnings"))
    console.log()
  } else if (format === "pretty") {
    console.log(chalk.green.bold("PASSED"))
    console.log()
  }

  process.exit(0)
}
