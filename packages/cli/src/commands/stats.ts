import chalk from "chalk"
import {
  loadGlobalEvents,
  loadProjectEvents,
  computeStats,
} from "@rulebound/engine"

interface StatsOptions {
  global?: boolean
  days?: string
  format?: string
  sync?: boolean
}

export async function statsCommand(options: StatsOptions): Promise<void> {
  const days = parseInt(options.days ?? "30", 10)
  const events = options.global
    ? loadGlobalEvents()
    : loadProjectEvents(process.cwd())

  if (events.length === 0) {
    console.log(chalk.dim("No validation events recorded yet."))
    console.log(chalk.dim("Run 'rulebound validate' or 'rulebound diff' to start collecting stats."))
    return
  }

  const stats = computeStats(events, days)

  if (options.format === "json") {
    console.log(JSON.stringify({
      totalValidations: stats.totalValidations,
      averageScore: stats.averageScore,
      topViolatedRules: stats.topViolatedRules,
      categoryBreakdown: Object.fromEntries(stats.categoryBreakdown),
      trendByDay: stats.trendByDay,
      sourceBreakdown: Object.fromEntries(stats.sourceBreakdown),
    }, null, 2))
    return
  }

  console.log()
  console.log(chalk.white("RULEBOUND STATS"))
  console.log(chalk.dim("\u2500".repeat(50)))
  console.log()

  console.log(`  ${chalk.dim("Period:")}        Last ${days} days`)
  console.log(`  ${chalk.dim("Validations:")}   ${stats.totalValidations}`)
  console.log(`  ${chalk.dim("Avg Score:")}     ${formatScore(stats.averageScore)}`)
  console.log()

  if (stats.topViolatedRules.length > 0) {
    console.log(chalk.white("  TOP VIOLATED RULES"))
    console.log(chalk.dim("  " + "\u2500".repeat(46)))
    for (const { ruleId, count } of stats.topViolatedRules) {
      const bar = "\u2588".repeat(Math.min(count, 30))
      console.log(`  ${chalk.red(ruleId.padEnd(30))} ${chalk.dim(String(count).padStart(4))} ${chalk.red(bar)}`)
    }
    console.log()
  }

  if (stats.categoryBreakdown.size > 0) {
    console.log(chalk.white("  VIOLATIONS BY CATEGORY"))
    console.log(chalk.dim("  " + "\u2500".repeat(46)))
    const total = [...stats.categoryBreakdown.values()].reduce((a, b) => a + b, 0)
    for (const [category, count] of stats.categoryBreakdown) {
      const pct = Math.round((count / total) * 100)
      console.log(`  ${chalk.yellow(category.padEnd(20))} ${String(count).padStart(4)} ${chalk.dim(`(${pct}%)`)}`)
    }
    console.log()
  }

  if (stats.sourceBreakdown.size > 0) {
    console.log(chalk.white("  BY SOURCE"))
    console.log(chalk.dim("  " + "\u2500".repeat(46)))
    for (const [source, count] of stats.sourceBreakdown) {
      console.log(`  ${chalk.blue(source.padEnd(20))} ${String(count).padStart(4)}`)
    }
    console.log()
  }

  if (stats.trendByDay.length > 0) {
    console.log(chalk.white("  DAILY TREND (last 7 days)"))
    console.log(chalk.dim("  " + "\u2500".repeat(46)))
    const recentDays = stats.trendByDay.slice(-7)
    for (const { date, score, violations } of recentDays) {
      console.log(`  ${chalk.dim(date)}  Score: ${formatScore(score)}  Violations: ${violations}`)
    }
    console.log()
  }
}

function formatScore(score: number): string {
  if (score >= 80) return chalk.green(String(score))
  if (score >= 60) return chalk.yellow(String(score))
  return chalk.red(String(score))
}
