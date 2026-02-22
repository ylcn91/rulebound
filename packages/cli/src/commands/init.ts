import { existsSync, mkdirSync, cpSync } from "node:fs"
import { resolve, join } from "node:path"
import chalk from "chalk"

interface InitOptions {
  examples?: boolean
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd()
  const rulesDir = resolve(cwd, ".rulebound", "rules")

  if (existsSync(rulesDir)) {
    console.log(chalk.yellow(`Rules directory already exists: ${rulesDir}`))
    console.log(chalk.dim("Use 'rulebound rules list' to see your rules."))
    return
  }

  mkdirSync(rulesDir, { recursive: true })
  console.log(chalk.white(`Created ${rulesDir}`))

  if (options.examples) {
    // Try to find the examples directory relative to the package
    const examplesDir = findExamplesDir()
    if (examplesDir) {
      cpSync(examplesDir, rulesDir, { recursive: true })
      console.log(chalk.white("Copied example rules."))
    } else {
      // Create a starter rule
      createStarterRule(rulesDir)
    }
  } else {
    createStarterRule(rulesDir)
  }

  console.log()
  console.log(chalk.white("Rulebound initialized."))
  console.log()
  console.log(chalk.dim("  Next steps:"))
  console.log(chalk.dim("  1. Add rules as markdown files in .rulebound/rules/"))
  console.log(chalk.dim("  2. Run: rulebound rules list"))
  console.log(chalk.dim("  3. Run: rulebound find-rules --task \"your task\""))
  console.log(chalk.dim("  4. Run: rulebound validate --plan \"your plan\""))
}

function findExamplesDir(): string | null {
  // Walk up to find the monorepo root with examples/
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "examples", "rules")
    if (existsSync(candidate)) return candidate
    const parent = resolve(dir, "..")
    if (parent === dir) break
    dir = parent
  }
  return null
}

function createStarterRule(rulesDir: string): void {
  const { writeFileSync } = require("node:fs") as typeof import("node:fs")

  const starterContent = `---
title: Example Rule
category: style
severity: warning
modality: should
tags: [example, starter]
---

# Example Rule

This is a starter rule. Replace it with your team's standards.

## Rules

- Write clear, descriptive function names
- Keep functions under 50 lines
- Add comments for non-obvious logic

## Good Example

\\\`\\\`\\\`typescript
function calculateOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
\\\`\\\`\\\`
`

  const globalDir = join(rulesDir, "global")
  mkdirSync(globalDir, { recursive: true })
  writeFileSync(join(globalDir, "example-rule.md"), starterContent)
}
