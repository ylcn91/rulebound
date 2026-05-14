import { existsSync, mkdirSync, writeFileSync, cpSync } from "node:fs"
import { resolve, join, basename } from "node:path"
import chalk from "chalk"
import { PRE_COMMIT_HOOK_CONTENT } from "../lib/pre-commit-hook.js"
import { findPack, findExamplesRoot, packNames, resolvePackEntries } from "../lib/packs.js"
import type { PackDefinition } from "../lib/packs.js"

interface InitOptions {
  examples?: boolean
  hook?: boolean
  migrate?: boolean
  pack?: string[] | string
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

function normalizePacks(input: InitOptions["pack"]): string[] {
  if (!input) return []
  const list = Array.isArray(input) ? input : [input]
  return list.map((p) => p.trim()).filter(Boolean)
}

interface PackInstallResult {
  readonly name: string
  readonly description: string
  readonly created: readonly string[]
  readonly skipped: readonly string[]
  readonly missing: boolean
}

function installPack(
  pack: PackDefinition,
  examplesRoot: string,
  rulesDir: string,
): PackInstallResult {
  const resolved = resolvePackEntries(pack, examplesRoot)
  const created: string[] = []
  const skipped: string[] = []
  if (resolved.entries.length === 0) {
    return { name: pack.name, description: pack.description, created, skipped, missing: true }
  }
  for (const entry of resolved.entries) {
    if (entry.isDirectory) {
      const dest = join(rulesDir, entry.destSubdir)
      if (existsSync(dest)) {
        skipped.push(dest)
        continue
      }
      mkdirSync(dest, { recursive: true })
      cpSync(entry.source, dest, { recursive: true })
      created.push(dest)
    } else {
      const dest = join(rulesDir, entry.destSubdir, basename(entry.source))
      if (existsSync(dest)) {
        skipped.push(dest)
        continue
      }
      mkdirSync(join(rulesDir, entry.destSubdir), { recursive: true })
      cpSync(entry.source, dest)
      created.push(dest)
    }
  }
  return { name: pack.name, description: pack.description, created, skipped, missing: false }
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd()
  const rulesDir = resolve(cwd, ".rulebound", "rules")
  const configPath = resolve(cwd, ".rulebound", "config.json")

  const packs = normalizePacks(options.pack)
  const unknown = packs.filter((p) => !findPack(p))
  if (unknown.length > 0) {
    console.error(chalk.red(`Unknown pack(s): ${unknown.join(", ")}`))
    console.error(chalk.gray(`Valid packs: ${packNames().join(", ")}`))
    process.exit(2)
  }

  const rulesDirExisted = existsSync(rulesDir)
  if (rulesDirExisted && packs.length === 0) {
    console.log(chalk.yellow(`Rules directory already exists: ${rulesDir}`))
    console.log(chalk.dim("Use 'rulebound rules list' to see your rules."))
    return
  }

  if (!rulesDirExisted) {
    mkdirSync(rulesDir, { recursive: true })
    console.log(chalk.white(`Created ${rulesDir}`))
  }

  if (!existsSync(configPath)) {
    writeFileSync(configPath, CONFIG_TEMPLATE)
    console.log(chalk.white(`Created ${configPath}`))
  }

  if (packs.length > 0) {
    const examplesRoot = findExamplesRoot(cwd)
    if (!examplesRoot) {
      console.error(chalk.red("No bundled examples found. Reinstall the CLI or run from the monorepo."))
      process.exit(2)
    }
    const results: PackInstallResult[] = []
    for (const name of packs) {
      const def = findPack(name)
      if (!def) continue
      results.push(installPack(def, examplesRoot.path, rulesDir))
    }
    printPackSummary(results)
  } else if (options.examples) {
    const examplesRoot = findExamplesRoot(cwd)
    if (examplesRoot) {
      cpSync(examplesRoot.path, rulesDir, { recursive: true })
      console.log(chalk.white("Copied example rules."))
      console.log()
      console.log(
        chalk.yellow(
          "Note: --examples installs the full showcase, including analyzer-oriented rules",
        ),
      )
      console.log(
        chalk.yellow(
          "      (PMD/Checkstyle/SpotBugs/Semgrep/gitleaks/ESLint/tsc) that warn unless the",
        ),
      )
      console.log(
        chalk.yellow(
          "      corresponding tools are installed and reports are available.",
        ),
      )
      console.log(
        chalk.dim(
          "      For a low-noise first run, try: rulebound init --pack starter --no-hook",
        ),
      )
    } else {
      createStarterRule(rulesDir)
    }
  } else if (!rulesDirExisted) {
    createStarterRule(rulesDir)
  }

  const gitDir = resolve(cwd, ".git")
  if (existsSync(gitDir) && options.hook !== false) {
    const hooksDir = resolve(gitDir, "hooks")
    const hookPath = resolve(hooksDir, "pre-commit")
    if (!existsSync(hookPath)) {
      const { chmodSync } = await import("node:fs")
      if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true })
      writeFileSync(hookPath, PRE_COMMIT_HOOK_CONTENT)
      chmodSync(hookPath, 0o755)
      console.log(chalk.white("Installed pre-commit hook."))
    }
  }

  console.log()
  console.log(chalk.white("Rulebound initialized."))

  if (options.migrate) {
    console.log()
    const { migrateCommand } = await import("./migrate.js")
    await migrateCommand({ auto: true })
  } else {
    console.log()
    console.log(chalk.dim("  Next steps:"))
    console.log(chalk.dim("  1. Edit .rulebound/config.json with your project info (stack, scope, team)"))
    console.log(chalk.dim("  2. Add or trim rules under .rulebound/rules/"))
    console.log(chalk.dim("  3. Run: rulebound rules list"))
    console.log(chalk.dim("  4. Run: rulebound check"))
    console.log(chalk.dim("  5. Run: rulebound generate --agent claude-code"))
    console.log(chalk.dim(""))
    console.log(chalk.dim("  Tip: rulebound init --pack starter for a low-noise first run, or"))
    console.log(chalk.dim("       rulebound init --pack typescript --pack security --pack agent-workflow."))
    console.log(chalk.dim("       Analyzer packs (analyzer-typescript, analyzer-java, analyzer-security) are opt-in."))
  }
}

function printPackSummary(results: readonly PackInstallResult[]): void {
  console.log()
  console.log(chalk.bold("Packs:"))
  for (const r of results) {
    if (r.missing) {
      console.log(`  ${chalk.red("✗")} ${chalk.bold(r.name)} ${chalk.gray("(pack source not found in bundle)")}`)
      continue
    }
    const status = r.created.length > 0 ? chalk.green("✓") : chalk.yellow("!")
    console.log(`  ${status} ${chalk.bold(r.name)} ${chalk.gray(`— ${r.description}`)}`)
    for (const path of r.created) console.log(chalk.gray(`    + ${path}`))
    for (const path of r.skipped) console.log(chalk.gray(`    skipped (already exists): ${path}`))
  }
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
`
  const globalDir = join(rulesDir, "global")
  mkdirSync(globalDir, { recursive: true })
  writeFileSync(join(globalDir, "example-rule.md"), starterContent)
}
