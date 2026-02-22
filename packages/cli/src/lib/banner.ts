import chalk from "chalk"

const BANNER = `
  ┌─────────────────────────────────────────┐
  │  RULEBOUND                              │
  │  AI Coding Agent Rule Enforcement       │
  └─────────────────────────────────────────┘`

export function printBanner(version: string): void {
  console.log(chalk.white(BANNER))
  console.log(chalk.dim(`  v${version} | MIT License | github.com/ylcn91/rulebound`))
  console.log()
}
