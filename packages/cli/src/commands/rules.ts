import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import chalk from "chalk"
import { findRulesDir, loadLocalRules, type LocalRule } from "../lib/local-rules.js"
import { loadRulesWithInheritance } from "../lib/inheritance.js"

interface ListOptions {
  dir?: string
}

interface ShowOptions {
  dir?: string
}

interface NewRuleOptions {
  dir?: string
  category?: string
  severity?: string
  title?: string
}

const MODALITY_LABELS: Record<string, string> = {
  must: "MUST",
  should: "SHOULD",
  may: "MAY",
}

type RuleTemplateType = "regex" | "diff-evidence"

function normalizeTemplateType(value: string): RuleTemplateType | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === "regex") return "regex"
  if (normalized === "diff-evidence" || normalized === "diff" || normalized === "evidence") {
    return "diff-evidence"
  }
  return null
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function titleize(value: string): string {
  return value
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function normalizeSeverity(value: string | undefined): "error" | "warning" | "info" {
  const severity = value ?? "error"
  if (severity === "error" || severity === "warning" || severity === "info") return severity

  console.error(chalk.red(`Unsupported severity: ${severity}`))
  console.error(chalk.dim("Use one of: error, warning, info."))
  process.exit(2)
}

function resolveRulesOutputDir(cwd: string, dir: string | undefined): string {
  if (dir) return resolve(cwd, dir)
  return findRulesDir(cwd) ?? resolve(cwd, ".rulebound", "rules")
}

function renderRuleTemplate(type: RuleTemplateType, title: string, category: string, severity: string, slug: string): string {
  if (type === "regex") {
    return `---
title: ${yamlString(title)}
category: ${category}
severity: ${severity}
modality: must
tags: [deterministic, regex]
checks:
  - type: regex
    id: ${slug}
    pattern: "TODO|FIXME"
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
    forbidden: true
    severity: ${severity}
    message: ${yamlString(`${title} pattern matched.`)}
---

# ${title}

This deterministic regex rule flags matching text in the configured files.
Customize \`pattern\`, \`files\`, and \`message\` before enforcing it broadly.
`
  }

  return `---
title: ${yamlString(title)}
category: ${category}
severity: ${severity}
modality: must
tags: [deterministic, diff-evidence]
checks:
  - type: diff-evidence
    id: ${slug}
    when_changed:
      - "src/**/*.ts"
    require_changed:
      - "tests/**/*.test.ts"
      - "tests/**/*.spec.ts"
    severity: ${severity}
    message: ${yamlString(`${title} evidence is missing.`)}
---

# ${title}

This deterministic diff-evidence rule requires supporting files whenever matching source files change.
Customize \`when_changed\`, \`require_changed\`, and \`message\` before enforcing it broadly.
`
}

export async function newRuleCommand(typeInput: string, name: string, options: NewRuleOptions): Promise<void> {
  const type = normalizeTemplateType(typeInput)
  if (!type) {
    console.error(chalk.red(`Unsupported rule template type: ${typeInput}`))
    console.error(chalk.dim("Use one of: regex, diff-evidence."))
    process.exit(2)
  }

  const slug = slugify(name)
  if (!slug) {
    console.error(chalk.red("Rule name must contain at least one letter or number."))
    process.exit(2)
  }

  const category = slugify(options.category ?? "general")
  if (!category) {
    console.error(chalk.red("Rule category must contain at least one letter or number."))
    process.exit(2)
  }

  const severity = normalizeSeverity(options.severity)
  const title = options.title?.trim() || titleize(name)
  const rulesDir = resolveRulesOutputDir(process.cwd(), options.dir)
  const outputPath = join(rulesDir, category, `${slug}.md`)

  if (existsSync(outputPath)) {
    console.error(chalk.red(`Rule template already exists: ${outputPath}`))
    console.error(chalk.dim("Choose a different name, category, or --dir. Existing files are never overwritten."))
    process.exit(2)
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, renderRuleTemplate(type, title, category, severity, slug))

  console.log(chalk.green(`Created ${type} rule template: ${outputPath}`))
}

export async function listRulesCommand(options: ListOptions): Promise<void> {
  let rules: LocalRule[]

  if (options.dir) {
    rules = loadLocalRules(options.dir)
  } else {
    rules = loadRulesWithInheritance(process.cwd())
  }

  if (rules.length === 0) {
    console.error(chalk.red("No rules found."))
    console.error(chalk.dim("Run 'rulebound init' to create rules, or use --dir <path>."))
    process.exit(1)
  }

  // Header
  const cols = {
    id: 30,
    category: 14,
    severity: 10,
    mode: 8,
    stack: 20,
    title: 30,
  }

  console.log(
    chalk.dim(
      `${"ID".padEnd(cols.id)}${"CATEGORY".padEnd(cols.category)}${"SEVERITY".padEnd(cols.severity)}${"MODE".padEnd(cols.mode)}${"STACK".padEnd(cols.stack)}TITLE`
    )
  )
  console.log(chalk.dim("\u2500".repeat(112)))

  for (const rule of rules) {
    const id = rule.id.length > cols.id - 1 ? rule.id.slice(0, cols.id - 4) + "..." : rule.id
    const mode = MODALITY_LABELS[rule.modality] ?? "SHOULD"
    const stack = rule.stack.length > 0 ? rule.stack.join(", ") : chalk.dim("global")
    const stackStr = stack.length > cols.stack - 1 ? stack.slice(0, cols.stack - 4) + "..." : stack

    console.log(
      `${id.padEnd(cols.id)}${rule.category.padEnd(cols.category)}${rule.severity.padEnd(cols.severity)}${mode.padEnd(cols.mode)}${stackStr.padEnd(cols.stack)}${rule.title}`
    )
  }

  const rulesDir = options.dir ?? findRulesDir(process.cwd()) ?? ".rulebound/rules"
  console.log()
  console.log(chalk.dim(`${rules.length} rules total from ${rulesDir}`))
}

export async function showRuleCommand(id: string, options: ShowOptions): Promise<void> {
  let rules: LocalRule[]

  if (options.dir) {
    rules = loadLocalRules(options.dir)
  } else {
    rules = loadRulesWithInheritance(process.cwd())
  }

  const rule = rules.find((r) => r.id === id)

  if (!rule) {
    console.error(chalk.red(`Rule not found: ${id}`))
    console.error(chalk.dim("Use 'rulebound rules list' to see available rules."))
    process.exit(1)
  }

  console.log()
  console.log(chalk.white("RULE DETAIL"))
  console.log(chalk.dim("\u2500".repeat(60)))
  console.log()
  console.log(`  ${chalk.dim("ID:")}       ${rule.id}`)
  console.log(`  ${chalk.dim("Title:")}    ${rule.title}`)
  console.log(`  ${chalk.dim("File:")}     ${rule.filePath}`)
  console.log(`  ${chalk.dim("Category:")} ${rule.category}`)
  console.log(`  ${chalk.dim("Severity:")} ${rule.severity}`)
  console.log(`  ${chalk.dim("Modality:")} ${MODALITY_LABELS[rule.modality] ?? rule.modality}`)
  console.log(`  ${chalk.dim("Tags:")}     ${rule.tags.join(", ") || chalk.dim("none")}`)
  console.log(`  ${chalk.dim("Stack:")}    ${rule.stack.join(", ") || chalk.dim("global")}`)
  console.log(`  ${chalk.dim("Scope:")}    ${rule.scope.join(", ") || chalk.dim("all")}`)
  if (rule.team.length > 0) {
    console.log(`  ${chalk.dim("Team:")}     ${rule.team.join(", ")}`)
  }
  console.log()
  console.log(chalk.white("CONTENT"))
  console.log(chalk.dim("\u2500".repeat(60)))
  console.log()
  console.log(rule.content)
}
