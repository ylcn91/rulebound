import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
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

export interface StartBugfixWorkflowInput {
  readonly summary: string
  readonly title?: string
  readonly condition?: string
  readonly postcondition?: string
  readonly preservationScenarios?: readonly string[]
  readonly rootCauseHypothesis?: string
  readonly filesInScope?: readonly string[]
  readonly filesOutOfScope?: readonly string[]
  readonly specPath?: string
  readonly writeSpec?: boolean
}

export interface StartBugfixWorkflowResult {
  readonly approved: boolean
  readonly path: string | null
  readonly spec: BugfixSpec
  readonly specValidation: BugfixValidationResult
  readonly planTemplate: string
  readonly message: string
}

export interface ValidateBugfixPlanInput {
  readonly plan: string
  readonly specPath?: string
  readonly specMarkdown?: string
}

export interface ValidateBugfixPlanResult {
  readonly approved: boolean
  readonly path: string | null
  readonly spec: BugfixSpec
  readonly specValidation: BugfixValidationResult
  readonly planValidation: BugfixValidationResult
  readonly message: string
}

function splitList(values: readonly string[] | undefined): readonly string[] {
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function defaultBugfixDir(cwd: string): string {
  return resolve(cwd, ".rulebound", "bugfixes")
}

function resolveSpecPath(cwd: string, specPath: string | undefined, slug: string): string {
  if (!specPath) {
    return join(defaultBugfixDir(cwd), `${slug}.md`)
  }

  const resolved = resolve(cwd, specPath)
  if (resolved.endsWith(".md")) {
    return resolved
  }

  return join(resolved, `${slug}.md`)
}

function findLatestBugfixSpec(cwd: string): string | null {
  const bugfixDir = defaultBugfixDir(cwd)
  if (!existsSync(bugfixDir)) {
    return null
  }

  const files = readdirSync(bugfixDir)
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => {
      const filePath = join(bugfixDir, entry)
      return {
        filePath,
        mtimeMs: statSync(filePath).mtimeMs,
      }
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)

  return files[0]?.filePath ?? null
}

function loadSpecFromPath(filePath: string): BugfixSpec {
  const markdown = readFileSync(filePath, "utf-8")
  return parseBugfixSpecMarkdown(markdown)
}

export function startBugfixWorkflow(input: StartBugfixWorkflowInput): StartBugfixWorkflowResult {
  const spec = createBugfixSpec({
    title: input.title,
    summary: input.summary,
    condition: input.condition,
    postcondition: input.postcondition,
    preservationScenarios: splitList(input.preservationScenarios),
    rootCauseHypothesis: input.rootCauseHypothesis,
    filesInScope: splitList(input.filesInScope),
    filesOutOfScope: splitList(input.filesOutOfScope),
  })
  const specValidation = validateBugfixSpec(spec)
  const planTemplate = renderBugfixPlanTemplate(spec)
  const shouldWrite = input.writeSpec !== false
  const path = shouldWrite
    ? resolveSpecPath(process.cwd(), input.specPath, spec.slug)
    : null

  if (path) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, renderBugfixSpecMarkdown(spec))
  }

  return {
    approved: specValidation.ok,
    path,
    spec,
    specValidation,
    planTemplate,
    message: specValidation.ok
      ? "Bugfix boundary created. Call validate_bugfix_plan before writing code."
      : "Bugfix boundary has validation issues. Fix the spec before writing code.",
  }
}

export function validateBugfixPlanRequest(
  input: ValidateBugfixPlanInput,
): ValidateBugfixPlanResult {
  const path = input.specPath
    ? resolve(process.cwd(), input.specPath)
    : input.specMarkdown
      ? null
      : findLatestBugfixSpec(process.cwd())

  if (!path && !input.specMarkdown) {
    throw new Error("No bugfix spec found. Start the workflow first or provide spec_path/spec_markdown.")
  }

  const spec = input.specMarkdown
    ? parseBugfixSpecMarkdown(input.specMarkdown)
    : loadSpecFromPath(path!)
  const specValidation = validateBugfixSpec(spec)
  const planValidation = validateBugfixPlan(spec, input.plan)
  const approved = specValidation.ok && planValidation.ok

  return {
    approved,
    path,
    spec,
    specValidation,
    planValidation,
    message: approved
      ? "Bugfix plan shape is valid. Safe to start coding."
      : "Bugfix plan is missing required boundary or preservation details. Do not write code yet.",
  }
}
