import chalk from "chalk"
import { findRulesDir, loadLocalRules, type LocalRule } from "../lib/local-rules.js"

interface LintOptions {
  dir?: string
}

interface QualityScore {
  atomicity: number
  completeness: number
  clarity: number
  total: number
  issues: string[]
}

function scoreRule(rule: LocalRule): QualityScore {
  const issues: string[] = []

  // ATOMICITY (0-5): One rule, one concern
  let atomicity = 5
  const bulletPoints = rule.content.match(/^- /gm)?.length ?? 0
  if (bulletPoints > 7) {
    atomicity -= 3
    issues.push("Too many bullet points (>7) — split into multiple rules")
  } else if (bulletPoints > 5) {
    atomicity -= 1
    issues.push("Consider splitting — many bullet points (>5)")
  }
  const headingCount = rule.content.match(/^## /gm)?.length ?? 0
  if (headingCount > 5) {
    atomicity -= 2
    issues.push("Too many sections — rule may cover multiple concerns")
  }

  // COMPLETENESS (0-5): Title + content + examples + tags + modality
  let completeness = 0
  if (rule.title.length > 10) completeness += 1
  else issues.push("Title too short — be descriptive")

  if (bulletPoints > 0) completeness += 1
  else issues.push("Missing rule bullets (- items)")

  if (rule.content.includes("```")) completeness += 1
  else issues.push("Missing code examples")

  if (rule.tags.length > 0) completeness += 1
  else issues.push("Missing tags — add for better search")

  if (rule.content.toLowerCase().includes("good example") && rule.content.toLowerCase().includes("bad example")) {
    completeness += 1
  } else {
    issues.push("Add both Good Example and Bad Example sections")
  }

  // CLARITY (0-5): Active voice, specific language
  let clarity = 0
  const contentLower = rule.content.toLowerCase()

  // Uses imperative/modal verbs
  if (/\b(must|never|always|shall)\b/.test(contentLower)) {
    clarity += 2
  } else if (/\b(should|prefer|avoid)\b/.test(contentLower)) {
    clarity += 1
    issues.push("Consider using stronger language (MUST/NEVER) for critical rules")
  } else {
    issues.push("Missing directive language — use MUST, NEVER, ALWAYS, SHOULD")
  }

  // Not too vague
  if (!/\b(etc|stuff|things|maybe|probably)\b/.test(contentLower)) {
    clarity += 1
  } else {
    issues.push("Remove vague words (etc, stuff, things, maybe)")
  }

  // Reasonable length
  if (rule.content.length > 100 && rule.content.length < 2000) {
    clarity += 1
  } else if (rule.content.length <= 100) {
    issues.push("Rule content too short — add detail")
  } else {
    issues.push("Rule content very long — consider splitting")
  }

  // Has specific actionable items
  if (bulletPoints >= 2) {
    clarity += 1
  }

  const total = Math.round(((atomicity + completeness + clarity) / 15) * 100)

  return {
    atomicity: Math.max(0, atomicity),
    completeness: Math.max(0, completeness),
    clarity: Math.max(0, clarity),
    total,
    issues,
  }
}

function renderBar(value: number, max: number = 5): string {
  const filled = Math.round((value / max) * 10)
  const empty = 10 - filled
  return chalk.white("█".repeat(filled)) + chalk.dim("░".repeat(empty))
}

export async function lintCommand(options: LintOptions): Promise<void> {
  const rulesDir = options.dir ?? findRulesDir(process.cwd())

  if (!rulesDir) {
    console.error(chalk.red("No rules directory found."))
    console.error(chalk.dim("Run 'rulebound init' to create one, or use --dir <path>."))
    process.exit(1)
  }

  const rules = loadLocalRules(rulesDir)

  if (rules.length === 0) {
    console.log(chalk.dim("No rules found."))
    return
  }

  console.log()
  console.log(chalk.white("RULE QUALITY REPORT"))
  console.log(chalk.dim("─".repeat(70)))
  console.log()

  let totalScore = 0
  let issueCount = 0

  for (const rule of rules) {
    const score = scoreRule(rule)
    totalScore += score.total

    const scoreColor = score.total >= 80 ? chalk.green : score.total >= 50 ? chalk.yellow : chalk.red
    const scoreLabel = scoreColor(`${score.total}%`)

    console.log(`  ${scoreLabel} ${chalk.white.bold(rule.title)}`)
    console.log(chalk.dim(`    ${rule.filePath}`))
    console.log(`    Atomicity:    ${renderBar(score.atomicity)} ${score.atomicity}/5`)
    console.log(`    Completeness: ${renderBar(score.completeness)} ${score.completeness}/5`)
    console.log(`    Clarity:      ${renderBar(score.clarity)} ${score.clarity}/5`)

    if (score.issues.length > 0) {
      for (const issue of score.issues) {
        issueCount++
        console.log(chalk.yellow(`    ! ${issue}`))
      }
    }

    console.log()
  }

  console.log(chalk.dim("─".repeat(70)))
  const avgScore = Math.round(totalScore / rules.length)
  const avgColor = avgScore >= 80 ? chalk.green : avgScore >= 50 ? chalk.yellow : chalk.red
  console.log(`  Average: ${avgColor(`${avgScore}%`)} across ${rules.length} rules`)
  console.log(`  Issues:  ${issueCount > 0 ? chalk.yellow(`${issueCount} improvements suggested`) : chalk.green("None")}`)
  console.log()
}
