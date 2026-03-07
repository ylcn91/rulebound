import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, join, basename } from "node:path"
import chalk from "chalk"
import {
  parseMarkdownToRules,
  ruleToMarkdown,
  KNOWN_AGENT_FILES,
  type ParsedRule,
} from "../lib/rule-parser.js"

interface MigrateOptions {
  from?: string
  auto?: boolean
  dryRun?: boolean
}

export async function migrateCommand(options: MigrateOptions): Promise<void> {
  const cwd = process.cwd()
  const rulesDir = resolve(cwd, ".rulebound", "rules")

  console.log()
  console.log(chalk.white("RULEBOUND MIGRATE"))
  console.log(chalk.dim("\u2500".repeat(50)))
  console.log()

  let files: string[] = []

  if (options.from) {
    const filePath = resolve(cwd, options.from)
    if (!existsSync(filePath)) {
      console.error(chalk.red(`File not found: ${options.from}`))
      process.exit(1)
    }
    files = [filePath]
  } else if (options.auto) {
    files = KNOWN_AGENT_FILES
      .map((f) => resolve(cwd, f))
      .filter((f) => existsSync(f))

    if (files.length === 0) {
      console.log(chalk.dim("No agent config files found."))
      console.log(chalk.dim("Looked for: " + KNOWN_AGENT_FILES.join(", ")))
      return
    }

    console.log(chalk.white(`Found ${files.length} file(s):`))
    for (const f of files) {
      console.log(`  ${chalk.dim(basename(f))}`)
    }
    console.log()
  } else {
    console.log(chalk.dim("Usage:"))
    console.log(chalk.dim("  rulebound migrate --from CLAUDE.md"))
    console.log(chalk.dim("  rulebound migrate --auto"))
    console.log(chalk.dim("  rulebound migrate --auto --dry-run"))
    return
  }

  let allRules: ParsedRule[] = []

  for (const file of files) {
    const content = readFileSync(file, "utf-8")
    const sourceFile = basename(file)
    const rules = parseMarkdownToRules(content, sourceFile)

    console.log(chalk.white(`Parsed ${rules.length} rule(s) from ${sourceFile}`))
    allRules.push(...rules)
  }

  if (allRules.length === 0) {
    console.log(chalk.dim("No rules extracted. Files may not contain heading-based rule sections."))
    return
  }

  // Deduplicate by slug
  const seen = new Set<string>()
  allRules = allRules.filter((r) => {
    if (seen.has(r.slug)) return false
    seen.add(r.slug)
    return true
  })

  console.log()
  console.log(chalk.white(`Total: ${allRules.length} unique rule(s)`))
  console.log()

  if (options.dryRun) {
    console.log(chalk.yellow("DRY RUN -- no files will be written"))
    console.log()
    for (const rule of allRules) {
      const outputPath = `${rule.category}/${rule.slug}.md`
      console.log(`  ${chalk.green("+")} ${chalk.white(rule.title)}`)
      console.log(`    ${chalk.dim(`-> .rulebound/rules/${outputPath}`)}`)
      console.log(`    ${chalk.dim(`category: ${rule.category} | severity: ${rule.severity} | modality: ${rule.modality}`)}`)
      console.log(`    ${chalk.dim(`tags: ${rule.tags.join(", ") || "(none)"}`)}`)
      console.log()
    }
    return
  }

  // Write rules
  if (!existsSync(rulesDir)) {
    mkdirSync(rulesDir, { recursive: true })
    console.log(chalk.dim(`Created ${rulesDir}`))
  }

  let written = 0
  for (const rule of allRules) {
    const categoryDir = join(rulesDir, rule.category)
    if (!existsSync(categoryDir)) {
      mkdirSync(categoryDir, { recursive: true })
    }

    const filePath = join(categoryDir, `${rule.slug}.md`)
    if (existsSync(filePath)) {
      console.log(`  ${chalk.yellow("~")} ${chalk.dim("skip")} ${rule.title} ${chalk.dim("(already exists)")}`)
      continue
    }

    writeFileSync(filePath, ruleToMarkdown(rule))
    console.log(`  ${chalk.green("+")} ${rule.title} ${chalk.dim(`-> ${rule.category}/${rule.slug}.md`)}`)
    written++
  }

  console.log()
  console.log(chalk.white(`Migrated ${written} rule(s) to .rulebound/rules/`))

  if (written > 0) {
    console.log()
    console.log(chalk.dim("Next steps:"))
    console.log(chalk.dim("  1. Review generated rules and adjust categories/severity"))
    console.log(chalk.dim("  2. Run: rulebound rules list"))
    console.log(chalk.dim("  3. Run: rulebound rules lint"))
  }
}
