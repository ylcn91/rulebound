import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, join } from "node:path"
import chalk from "chalk"

interface InitOptions {
  examples?: boolean
}

const CONFIG_TEMPLATE = `{
  "project": {
    "name": "",
    "stack": [],
    "scope": [],
    "team": ""
  },
  "extends": [],
  "rulesDir": ".rulebound/rules"
}
`

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd()
  const rulesDir = resolve(cwd, ".rulebound", "rules")
  const configPath = resolve(cwd, ".rulebound", "config.json")

  if (existsSync(rulesDir)) {
    console.log(chalk.yellow(`Rules directory already exists: ${rulesDir}`))
    console.log(chalk.dim("Use 'rulebound rules list' to see your rules."))
    return
  }

  mkdirSync(rulesDir, { recursive: true })
  console.log(chalk.white(`Created ${rulesDir}`))

  // Create config.json
  if (!existsSync(configPath)) {
    writeFileSync(configPath, CONFIG_TEMPLATE)
    console.log(chalk.white(`Created ${configPath}`))
  }

  if (options.examples) {
    const examplesDir = findExamplesDir()
    if (examplesDir) {
      const { cpSync } = await import("node:fs")
      cpSync(examplesDir, rulesDir, { recursive: true })
      console.log(chalk.white("Copied example rules."))
    } else {
      createStarterRule(rulesDir)
    }
  } else {
    createStarterRule(rulesDir)
  }

  console.log()
  console.log(chalk.white("Rulebound initialized."))
  console.log()
  console.log(chalk.dim("  Next steps:"))
  console.log(chalk.dim("  1. Edit .rulebound/config.json with your project info (stack, scope, team)"))
  console.log(chalk.dim("  2. Add rules as markdown files in .rulebound/rules/"))
  console.log(chalk.dim("  3. Run: rulebound rules list"))
  console.log(chalk.dim("  4. Run: rulebound generate --agent claude-code"))
  console.log(chalk.dim("  5. Run: rulebound validate --plan \"your plan\""))
}

function findExamplesDir(): string | null {
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
  const starterContent = `---
title: Example Rule
category: style
severity: warning
modality: should
tags: [example, starter]
stack: []
scope: []
---

# Example Rule

This is a starter rule. Replace it with your team's standards.

## Rules

- Write clear, descriptive function names
- Keep functions under 50 lines
- Add comments for non-obvious logic

## Good Example

\`\`\`typescript
function calculateOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
\`\`\`
`

  const globalDir = join(rulesDir, "global")
  mkdirSync(globalDir, { recursive: true })
  writeFileSync(join(globalDir, "example-rule.md"), starterContent)
}
