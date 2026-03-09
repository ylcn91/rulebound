const DEFAULT_SCOPE_PLACEHOLDER = "No explicit scope declared yet."
const DEFAULT_OUT_OF_SCOPE_PLACEHOLDER = "No explicit out-of-scope files declared."

const PLAN_SECTION_TITLES = {
  rootCauseHypothesis: "Root Cause Hypothesis",
  changeStrategy: "Change Strategy",
  fixValidation: "Fix Validation",
  preservationChecks: "Preservation Checks",
  scopeGuardrails: "Scope Guardrails",
} as const

export interface BugCondition {
  readonly description: string
}

export interface Postcondition {
  readonly description: string
}

export interface PreservationScenario {
  readonly description: string
}

export interface BugfixSpecDraft {
  readonly title?: string
  readonly summary: string
  readonly condition?: string
  readonly postcondition?: string
  readonly preservationScenarios?: readonly string[]
  readonly rootCauseHypothesis?: string
  readonly fixTests?: readonly string[]
  readonly preservationTests?: readonly string[]
  readonly filesInScope?: readonly string[]
  readonly filesOutOfScope?: readonly string[]
  readonly slug?: string
  readonly createdAt?: string
}

export interface BugfixSpec {
  readonly title: string
  readonly slug: string
  readonly summary: string
  readonly condition: BugCondition
  readonly postcondition: Postcondition
  readonly preservationScenarios: readonly PreservationScenario[]
  readonly rootCauseHypothesis: string
  readonly fixTests: readonly string[]
  readonly preservationTests: readonly string[]
  readonly filesInScope: readonly string[]
  readonly filesOutOfScope: readonly string[]
  readonly createdAt: string
}

export interface BugfixPlan {
  readonly rootCauseHypothesis: string
  readonly changeStrategy: string
  readonly fixValidation: readonly string[]
  readonly preservationChecks: readonly string[]
  readonly scopeGuardrails: readonly string[]
}

export interface BugfixValidationIssue {
  readonly field: string
  readonly message: string
  readonly severity: "error" | "warning"
}

export interface BugfixValidationResult {
  readonly ok: boolean
  readonly issues: readonly BugfixValidationIssue[]
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function normalizeList(values: readonly string[] | undefined): readonly string[] {
  return (values ?? [])
    .map((value) => normalizeWhitespace(value))
    .filter((value) => value.length > 0)
}

function fallbackTitle(summary: string): string {
  const normalized = normalizeWhitespace(summary)
  if (normalized.length <= 72) {
    return normalized
  }
  return `${normalized.slice(0, 69).trimEnd()}...`
}

function buildDefaultCondition(summary: string): string {
  return `When ${normalizeWhitespace(summary).replace(/\.$/, "")}.`
}

function buildDefaultPostcondition(): string {
  return "The reported bug no longer reproduces and the intended flow completes successfully."
}

function buildDefaultPreservationScenarios(): readonly string[] {
  return ["Behavior outside the bug condition remains unchanged."]
}

function buildDefaultRootCause(): string {
  return "The bug is caused by a boundary-specific defect that should be fixed without changing unrelated flows."
}

function buildDefaultFixTests(condition: string, postcondition: string): readonly string[] {
  return [`Add a failing test for "${condition}" and assert "${postcondition}".`]
}

function buildDefaultPreservationTests(
  preservationScenarios: readonly PreservationScenario[],
): readonly string[] {
  return preservationScenarios.map(
    (scenario) => `Add a preservation test proving "${scenario.description}" remains unchanged.`,
  )
}

function stripBulletPrefix(value: string): string {
  return value.replace(/^[-*]\s+/, "").trim()
}

function parseFrontmatter(markdown: string): { frontmatter: Record<string, string>; body: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: markdown }
  }

  const frontmatter: Record<string, string> = {}
  for (const line of match[1].split("\n")) {
    const pair = line.match(/^([\w-]+):\s*(.+)$/)
    if (!pair) {
      continue
    }
    frontmatter[pair[1]] = pair[2].trim()
  }

  return { frontmatter, body: match[2] }
}

function parseMarkdownSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>()
  const lines = markdown.split("\n")
  let currentSection: string | null = null
  let buffer: string[] = []

  const flush = () => {
    if (currentSection !== null) {
      sections.set(currentSection, buffer.join("\n").trim())
    }
    buffer = []
  }

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      flush()
      currentSection = heading[1].trim()
      continue
    }

    if (currentSection !== null) {
      buffer.push(line)
    }
  }

  flush()
  return sections
}

function parseBullets(sectionBody: string | undefined): readonly string[] {
  if (!sectionBody) {
    return []
  }

  return sectionBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map(stripBulletPrefix)
    .filter((line) => line.length > 0)
}

function buildPlanSection(title: string, body: string | readonly string[]): string {
  let content: string

  if (typeof body === "string") {
    content = body.trim().length > 0 ? body.trim() : "TBD"
  } else {
    content = body.length > 0 ? body.map((item) => `- ${item}`).join("\n") : "- TBD"
  }

  return `## ${title}\n${content}\n`
}

function significantTokens(value: string): readonly string[] {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)
}

function overlapsByMeaning(left: string, right: string): boolean {
  const leftTokens = new Set(significantTokens(left))
  if (leftTokens.size === 0) {
    return false
  }

  for (const token of significantTokens(right)) {
    if (leftTokens.has(token)) {
      return true
    }
  }

  return false
}

export function slugifyBugfixTitle(value: string): string {
  const slug = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "bugfix"
}

export function createBugfixSpec(draft: BugfixSpecDraft): BugfixSpec {
  const summary = normalizeWhitespace(draft.summary)
  const title = normalizeWhitespace(draft.title ?? fallbackTitle(summary))
  const condition = normalizeWhitespace(draft.condition ?? buildDefaultCondition(summary))
  const postcondition = normalizeWhitespace(draft.postcondition ?? buildDefaultPostcondition())
  const preservationScenarioDescriptions = normalizeList(draft.preservationScenarios)
  const preservationScenarios = (
    preservationScenarioDescriptions.length > 0
      ? preservationScenarioDescriptions
      : buildDefaultPreservationScenarios()
  ).map((description) => ({ description }))
  const rootCauseHypothesis = normalizeWhitespace(draft.rootCauseHypothesis ?? buildDefaultRootCause())
  const fixTests = normalizeList(draft.fixTests)
  const preservationTests = normalizeList(draft.preservationTests)
  const filesInScope = normalizeList(draft.filesInScope)
  const filesOutOfScope = normalizeList(draft.filesOutOfScope)

  return {
    title,
    slug: slugifyBugfixTitle(draft.slug ?? title),
    summary,
    condition: { description: condition },
    postcondition: { description: postcondition },
    preservationScenarios,
    rootCauseHypothesis,
    fixTests: fixTests.length > 0 ? fixTests : buildDefaultFixTests(condition, postcondition),
    preservationTests: preservationTests.length > 0
      ? preservationTests
      : buildDefaultPreservationTests(preservationScenarios),
    filesInScope,
    filesOutOfScope,
    createdAt: draft.createdAt ?? new Date().toISOString(),
  }
}

export function validateBugfixSpec(spec: BugfixSpec): BugfixValidationResult {
  const issues: BugfixValidationIssue[] = []

  if (normalizeWhitespace(spec.title).length === 0) {
    issues.push({ field: "title", message: "Title is required.", severity: "error" })
  }

  if (normalizeWhitespace(spec.summary).length === 0) {
    issues.push({ field: "summary", message: "Summary is required.", severity: "error" })
  }

  if (normalizeWhitespace(spec.condition.description).length === 0) {
    issues.push({ field: "condition", message: "Bug condition C is required.", severity: "error" })
  }

  if (normalizeWhitespace(spec.postcondition.description).length === 0) {
    issues.push({ field: "postcondition", message: "Postcondition P is required.", severity: "error" })
  }

  if (spec.preservationScenarios.length === 0) {
    issues.push({
      field: "preservationScenarios",
      message: "At least one preservation scenario is required.",
      severity: "error",
    })
  }

  if (normalizeWhitespace(spec.rootCauseHypothesis).length === 0) {
    issues.push({
      field: "rootCauseHypothesis",
      message: "Root cause hypothesis is required.",
      severity: "error",
    })
  }

  if (spec.fixTests.length === 0) {
    issues.push({
      field: "fixTests",
      message: "At least one fix test is required.",
      severity: "error",
    })
  }

  if (spec.preservationTests.length === 0) {
    issues.push({
      field: "preservationTests",
      message: "At least one preservation test is required.",
      severity: "error",
    })
  }

  if (spec.filesInScope.length === 0) {
    issues.push({
      field: "filesInScope",
      message: "Declare at least one in-scope file or note that scope is still pending.",
      severity: "warning",
    })
  }

  if (spec.filesOutOfScope.length === 0) {
    issues.push({
      field: "filesOutOfScope",
      message: "Declare out-of-scope files to make the preservation boundary explicit.",
      severity: "warning",
    })
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
  }
}

export function renderBugfixSpecMarkdown(spec: BugfixSpec): string {
  const inScope = spec.filesInScope.length > 0 ? spec.filesInScope : [DEFAULT_SCOPE_PLACEHOLDER]
  const outOfScope = spec.filesOutOfScope.length > 0 ? spec.filesOutOfScope : [DEFAULT_OUT_OF_SCOPE_PLACEHOLDER]

  return `---
slug: ${spec.slug}
created-at: ${spec.createdAt}
---
# Bugfix Boundary: ${spec.title}

${buildPlanSection("Summary", spec.summary)}
${buildPlanSection("Bug Condition (C)", spec.condition.description)}
${buildPlanSection("Postcondition (P)", spec.postcondition.description)}
${buildPlanSection("Preservation Scenarios", spec.preservationScenarios.map((scenario) => scenario.description))}
${buildPlanSection("Root Cause Hypothesis", spec.rootCauseHypothesis)}
${buildPlanSection("Fix Tests", spec.fixTests)}
${buildPlanSection("Preservation Tests", spec.preservationTests)}
${buildPlanSection("Files In Scope", inScope)}
${buildPlanSection("Files Explicitly Out Of Scope", outOfScope)}
`.trimEnd() + "\n"
}

export function parseBugfixSpecMarkdown(markdown: string): BugfixSpec {
  const { frontmatter, body } = parseFrontmatter(markdown)
  const titleMatch = body.match(/^#\s+Bugfix Boundary:\s+(.+)$/m)
  const sections = parseMarkdownSections(body)

  return createBugfixSpec({
    title: titleMatch?.[1]?.trim() ?? frontmatter.slug ?? "Bugfix",
    slug: frontmatter.slug,
    createdAt: frontmatter["created-at"],
    summary: sections.get("Summary") ?? "",
    condition: sections.get("Bug Condition (C)") ?? "",
    postcondition: sections.get("Postcondition (P)") ?? "",
    preservationScenarios: parseBullets(sections.get("Preservation Scenarios")),
    rootCauseHypothesis: sections.get("Root Cause Hypothesis") ?? "",
    fixTests: parseBullets(sections.get("Fix Tests")),
    preservationTests: parseBullets(sections.get("Preservation Tests")),
    filesInScope: parseBullets(sections.get("Files In Scope")).filter(
      (value) => value !== DEFAULT_SCOPE_PLACEHOLDER,
    ),
    filesOutOfScope: parseBullets(sections.get("Files Explicitly Out Of Scope")).filter(
      (value) => value !== DEFAULT_OUT_OF_SCOPE_PLACEHOLDER,
    ),
  })
}

export function renderBugfixPlanTemplate(spec: BugfixSpec): string {
  return [
    buildPlanSection(PLAN_SECTION_TITLES.rootCauseHypothesis, spec.rootCauseHypothesis),
    buildPlanSection(PLAN_SECTION_TITLES.changeStrategy, `Change only what is necessary to satisfy "${spec.postcondition.description}".`),
    buildPlanSection(PLAN_SECTION_TITLES.fixValidation, spec.fixTests),
    buildPlanSection(PLAN_SECTION_TITLES.preservationChecks, spec.preservationTests),
    buildPlanSection(
      PLAN_SECTION_TITLES.scopeGuardrails,
      [
        ...spec.filesInScope.map((filePath) => `Limit edits to ${filePath}.`),
        ...spec.filesOutOfScope.map((filePath) => `Do not modify ${filePath}.`),
      ],
    ),
  ].join("\n").trimEnd() + "\n"
}

export function parseBugfixPlan(markdown: string): BugfixPlan {
  const sections = parseMarkdownSections(markdown)

  return {
    rootCauseHypothesis: sections.get(PLAN_SECTION_TITLES.rootCauseHypothesis) ?? "",
    changeStrategy: sections.get(PLAN_SECTION_TITLES.changeStrategy) ?? "",
    fixValidation: parseBullets(sections.get(PLAN_SECTION_TITLES.fixValidation)),
    preservationChecks: parseBullets(sections.get(PLAN_SECTION_TITLES.preservationChecks)),
    scopeGuardrails: parseBullets(sections.get(PLAN_SECTION_TITLES.scopeGuardrails)),
  }
}

export function validateBugfixPlan(
  spec: BugfixSpec,
  planOrMarkdown: BugfixPlan | string,
): BugfixValidationResult {
  const plan = typeof planOrMarkdown === "string"
    ? parseBugfixPlan(planOrMarkdown)
    : planOrMarkdown

  const issues: BugfixValidationIssue[] = []

  if (normalizeWhitespace(plan.rootCauseHypothesis).length === 0) {
    issues.push({
      field: "plan.rootCauseHypothesis",
      message: "Plan must include a root cause hypothesis section.",
      severity: "error",
    })
  }

  if (normalizeWhitespace(plan.changeStrategy).length === 0) {
    issues.push({
      field: "plan.changeStrategy",
      message: "Plan must include a change strategy section.",
      severity: "error",
    })
  }

  if (plan.fixValidation.length === 0) {
    issues.push({
      field: "plan.fixValidation",
      message: "Plan must include at least one fix validation step tied to C => P.",
      severity: "error",
    })
  } else if (!plan.fixValidation.some((entry) =>
    overlapsByMeaning(entry, spec.condition.description) || overlapsByMeaning(entry, spec.postcondition.description)
  )) {
    issues.push({
      field: "plan.fixValidation",
      message: "Fix validation must reference the bug condition or postcondition.",
      severity: "error",
    })
  }

  if (plan.preservationChecks.length === 0) {
    issues.push({
      field: "plan.preservationChecks",
      message: "Plan must include preservation checks for behavior outside C.",
      severity: "error",
    })
  } else {
    const uncoveredScenarios = spec.preservationScenarios.filter((scenario) =>
      !plan.preservationChecks.some((entry) => overlapsByMeaning(entry, scenario.description)),
    )

    if (uncoveredScenarios.length > 0) {
      issues.push({
        field: "plan.preservationChecks",
        message: `Preservation checks must cover all declared scenarios. Missing: ${uncoveredScenarios.map((scenario) => `"${scenario.description}"`).join(", ")}.`,
        severity: "error",
      })
    }
  }

  if (plan.scopeGuardrails.length === 0) {
    issues.push({
      field: "plan.scopeGuardrails",
      message: "Plan must include scope guardrails before code writing.",
      severity: "error",
    })
  } else if (
    spec.filesOutOfScope.length > 0 &&
    !spec.filesOutOfScope.every((filePath) =>
      plan.scopeGuardrails.some((entry) => entry.includes(filePath)),
    )
  ) {
    issues.push({
      field: "plan.scopeGuardrails",
      message: "Scope guardrails must mention the declared out-of-scope files.",
      severity: "warning",
    })
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    issues,
  }
}
