import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import chalk from "chalk"
import {
  createBugfixSpec,
  parseBugfixSpecMarkdown,
  renderBugfixPlanTemplate,
  renderBugfixSpecMarkdown,
  validateBugfixPlan,
  validateBugfixSpec,
  type BugfixSpec,
  type BugfixValidationResult,
} from "@rulebound/engine"

interface BugfixCommandOptions {
  readonly summary?: string
  readonly title?: string
  readonly condition?: string
  readonly postcondition?: string
  readonly preserve?: string
  readonly rootCause?: string
  readonly scope?: string
  readonly outOfScope?: string
  readonly output?: string
  readonly format?: string
  readonly force?: boolean
}

interface ValidateBugfixCommandOptions {
  readonly file?: string
  readonly plan?: string
  readonly planFile?: string
  readonly format?: string
}

function splitListOption(value: string | undefined): readonly string[] {
  if (!value) {
    return []
  }

  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function defaultBugfixDir(cwd: string): string {
  return resolve(cwd, ".rulebound", "bugfixes")
}

function resolveOutputPath(cwd: string, output: string | undefined, slug: string): string {
  if (!output) {
    return join(defaultBugfixDir(cwd), `${slug}.md`)
  }

  const resolved = resolve(cwd, output)
  if (resolved.endsWith(".md")) {
    return resolved
  }

  return join(resolved, `${slug}.md`)
}

function readPlanText(options: ValidateBugfixCommandOptions): string | undefined {
  if (options.planFile) {
    try {
      return readFileSync(options.planFile, "utf-8")
    } catch (_error) {
      console.error(chalk.red(`Failed to read plan file: ${options.planFile}`))
      process.exit(1)
    }
  }

  return options.plan
}

function findLatestBugfixFile(cwd: string): string | null {
  const bugfixDir = defaultBugfixDir(cwd)
  if (!existsSync(bugfixDir)) {
    return null
  }

  const entries = readdirSync(bugfixDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => {
      const filePath = join(bugfixDir, entry)
      return {
        filePath,
        mtimeMs: statSync(filePath).mtimeMs,
      }
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)

  return entries[0]?.filePath ?? null
}

function loadBugfixSpec(filePath: string): BugfixSpec {
  try {
    const markdown = readFileSync(filePath, "utf-8")
    return parseBugfixSpecMarkdown(markdown)
  } catch (_error) {
    console.error(chalk.red(`Failed to read bugfix spec: ${filePath}`))
    process.exit(1)
  }
}

function printValidationIssues(title: string, validation: BugfixValidationResult): void {
  if (validation.issues.length === 0) {
    console.log(chalk.green(`  ${title}: OK`))
    return
  }

  const hasErrors = validation.issues.some((issue) => issue.severity === "error")
  console.log(hasErrors ? chalk.red(`  ${title}: FAIL`) : chalk.yellow(`  ${title}: WARN`))

  for (const issue of validation.issues) {
    const color = issue.severity === "error" ? chalk.red : chalk.yellow
    console.log(color(`    - [${issue.severity}] ${issue.field}: ${issue.message}`))
  }
}

export async function bugfixCommand(options: BugfixCommandOptions): Promise<void> {
  const summary = options.summary?.trim()
  if (!summary) {
    console.error(chalk.red("Provide a bug summary, for example: rulebound bugfix --summary \"Deleting a user crashes when billing is null\""))
    process.exit(1)
  }

  const spec = createBugfixSpec({
    title: options.title,
    summary,
    condition: options.condition,
    postcondition: options.postcondition,
    preservationScenarios: splitListOption(options.preserve),
    rootCauseHypothesis: options.rootCause,
    filesInScope: splitListOption(options.scope),
    filesOutOfScope: splitListOption(options.outOfScope),
  })
  const validation = validateBugfixSpec(spec)
  const cwd = process.cwd()
  const outputPath = resolveOutputPath(cwd, options.output, spec.slug)

  if (existsSync(outputPath) && options.force !== true) {
    console.error(chalk.red(`Bugfix spec already exists: ${outputPath}`))
    console.error(chalk.dim("Pass --force to overwrite it."))
    process.exit(1)
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, renderBugfixSpecMarkdown(spec))

  const planTemplate = renderBugfixPlanTemplate(spec)

  if (options.format === "json") {
    console.log(JSON.stringify({
      path: outputPath,
      spec,
      validation,
      planTemplate,
    }, null, 2))
    return
  }

  console.log()
  console.log(chalk.white.bold("BUGFIX WORKFLOW"))
  console.log(chalk.dim(`Spec: ${outputPath}`))
  console.log(chalk.dim(`Slug: ${spec.slug}`))
  console.log()
  console.log(chalk.white(`  C: ${spec.condition.description}`))
  console.log(chalk.white(`  P: ${spec.postcondition.description}`))
  console.log(chalk.white(`  Preserve: ${spec.preservationScenarios.map((scenario) => scenario.description).join(" | ")}`))
  console.log()
  printValidationIssues("Spec validation", validation)
  console.log()
  console.log(chalk.dim("  Plan template:"))
  console.log(chalk.dim(planTemplate.trimEnd()))
  console.log()
  console.log(chalk.dim(`  Next: rulebound bugfix validate --file ${outputPath}`))
}

export async function validateBugfixCommand(options: ValidateBugfixCommandOptions): Promise<void> {
  const cwd = process.cwd()
  const filePath = options.file
    ? resolve(cwd, options.file)
    : findLatestBugfixFile(cwd)

  if (!filePath) {
    console.error(chalk.red("No bugfix spec found. Run 'rulebound bugfix --summary \"...\"' first or pass --file."))
    process.exit(1)
  }

  const spec = loadBugfixSpec(filePath)
  const specValidation = validateBugfixSpec(spec)
  const planText = readPlanText(options)
  const planValidation = planText ? validateBugfixPlan(spec, planText) : null
  const ok = specValidation.ok && (planValidation?.ok ?? true)

  if (options.format === "json") {
    console.log(JSON.stringify({
      file: filePath,
      spec,
      specValidation,
      planValidation,
      ok,
    }, null, 2))
    if (!ok) {
      process.exit(1)
    }
    return
  }

  console.log()
  console.log(chalk.white.bold("BUGFIX VALIDATION"))
  console.log(chalk.dim(`Spec: ${filePath}`))
  console.log()
  printValidationIssues("Spec", specValidation)
  if (planValidation) {
    printValidationIssues("Plan", planValidation)
  } else {
    console.log(chalk.dim("  Plan: skipped (provide --plan or --plan-file to validate plan shape)"))
  }
  console.log()

  if (!ok) {
    console.log(chalk.red.bold("BUGFIX WORKFLOW INVALID"))
    process.exit(1)
  }

  console.log(chalk.green.bold("BUGFIX WORKFLOW VALID"))
}
