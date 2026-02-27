import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import chalk from "chalk"
import { findRulesDir, loadLocalRules } from "../lib/local-rules.js"

interface ScoreOptions {
  dir?: string
  badge?: boolean
  output?: string
}

interface RuleScore {
  atomicity: number
  completeness: number
  clarity: number
}

function scoreRule(rule: { title: string; content: string; tags: readonly string[]; modality: string }): RuleScore {
  const bulletPoints = rule.content.match(/^- /gm)?.length ?? 0
  const headingCount = rule.content.match(/^## /gm)?.length ?? 0
  const contentLower = rule.content.toLowerCase()

  // Atomicity
  let atomicity = 5
  if (bulletPoints > 7) atomicity -= 3
  else if (bulletPoints > 5) atomicity -= 1
  if (headingCount > 5) atomicity -= 2

  // Completeness
  let completeness = 0
  if (rule.title.length > 10) completeness += 1
  if (bulletPoints > 0) completeness += 1
  if (rule.content.includes("```")) completeness += 1
  if (rule.tags.length > 0) completeness += 1
  if (contentLower.includes("good example") && contentLower.includes("bad example")) completeness += 1

  // Clarity
  let clarity = 0
  if (/\b(must|never|always|shall)\b/.test(contentLower)) clarity += 2
  else if (/\b(should|prefer|avoid)\b/.test(contentLower)) clarity += 1
  if (!/\b(etc|stuff|things|maybe|probably)\b/.test(contentLower)) clarity += 1
  if (rule.content.length > 100 && rule.content.length < 2000) clarity += 1
  if (bulletPoints >= 2) clarity += 1

  return {
    atomicity: Math.max(0, atomicity),
    completeness: Math.max(0, completeness),
    clarity: Math.max(0, clarity),
  }
}

function generateBadgeUrl(score: number): string {
  const color = score >= 80 ? "%234c1" : score >= 60 ? "%23dfb317" : "%23e05d44"
  return `https://img.shields.io/badge/rulebound-${score}%25-${color}?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48cmVjdCB3aWR0aD0iMTIiIGhlaWdodD0iMTQiIHg9IjIiIHk9IjEiIHJ4PSIxIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjEuNSIvPjxsaW5lIHgxPSI1IiB5MT0iNSIgeDI9IjExIiB5Mj0iNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48bGluZSB4MT0iNSIgeTE9IjgiIHgyPSIxMSIgeTI9IjgiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMS41Ii8+PGxpbmUgeDE9IjUiIHkxPSIxMSIgeDI9IjkiIHkyPSIxMSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz48L3N2Zz4=`
}

export async function scoreCommand(options: ScoreOptions): Promise<void> {
  const rulesDir = options.dir ?? findRulesDir(process.cwd())

  if (!rulesDir) {
    console.error(chalk.red("No rules directory found."))
    process.exit(1)
  }

  const rules = loadLocalRules(rulesDir)

  if (rules.length === 0) {
    console.log(chalk.dim("No rules found."))
    return
  }

  let totalScore = 0

  for (const rule of rules) {
    const s = scoreRule(rule)
    const ruleScore = Math.round(((s.atomicity + s.completeness + s.clarity) / 15) * 100)
    totalScore += ruleScore
  }

  const avgScore = Math.round(totalScore / rules.length)
  const scoreColor = avgScore >= 80 ? chalk.green : avgScore >= 60 ? chalk.yellow : chalk.red

  console.log()
  console.log(chalk.white("RULE QUALITY SCORE"))
  console.log(chalk.dim("\u2500".repeat(40)))
  console.log()
  console.log(`  Score: ${scoreColor.bold(`${avgScore}/100`)}`)
  console.log(`  Rules: ${rules.length}`)
  console.log(`  Grade: ${avgScore >= 90 ? "A" : avgScore >= 80 ? "B" : avgScore >= 70 ? "C" : avgScore >= 60 ? "D" : "F"}`)
  console.log()
  console.log(chalk.dim("  This measures how well your rules are written,"))
  console.log(chalk.dim("  not code compliance. Use 'validate' for that."))
  console.log()

  // Category breakdown
  const categories = new Map<string, { count: number; totalScore: number }>()
  for (const rule of rules) {
    const s = scoreRule(rule)
    const ruleScore = Math.round(((s.atomicity + s.completeness + s.clarity) / 15) * 100)
    const cat = categories.get(rule.category) ?? { count: 0, totalScore: 0 }
    cat.count++
    cat.totalScore += ruleScore
    categories.set(rule.category, cat)
  }

  console.log(chalk.dim("  Category Breakdown:"))
  for (const [cat, data] of categories) {
    const catAvg = Math.round(data.totalScore / data.count)
    const catColor = catAvg >= 80 ? chalk.green : catAvg >= 60 ? chalk.yellow : chalk.red
    console.log(`    ${cat.padEnd(16)} ${catColor(`${catAvg}%`)} (${data.count} rules)`)
  }
  console.log()

  // Badge
  if (options.badge !== false) {
    const badgeUrl = generateBadgeUrl(avgScore)
    const badgeMarkdown = `[![Rulebound Score](${badgeUrl})](https://github.com/ylcn91/rulebound)`

    console.log(chalk.dim("  Badge (paste in README.md):"))
    console.log()
    console.log(`  ${badgeMarkdown}`)
    console.log()

    if (options.output) {
      writeFileSync(resolve(options.output), badgeMarkdown + "\n")
      console.log(chalk.dim(`  Saved to ${options.output}`))
    }
  }
}
