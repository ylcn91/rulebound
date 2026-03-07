import chalk from "chalk"
import { resolve, join } from "node:path"
import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs"
import { execSync } from "node:child_process"

interface RegistrySearchResult {
  name: string
  description: string
  version: string
  keywords: string[]
}

interface RegistrySearchOptions {
  query?: string
}

interface RegistryInstallOptions {
  package: string
}

interface RegistryInfoOptions {
  package: string
}

export async function registrySearchCommand(query: string): Promise<void> {
  const searchTerm = query || "@rulebound/rules-"
  console.log()
  console.log(chalk.white("REGISTRY SEARCH"))
  console.log(chalk.dim("\u2500".repeat(50)))
  console.log(chalk.dim(`Searching npm for: ${searchTerm}`))
  console.log()

  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(searchTerm)}&size=20`
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) {
      console.error(chalk.red("Failed to search npm registry"))
      return
    }

    const data = await response.json() as { objects: Array<{ package: RegistrySearchResult }> }
    const packages = data.objects
      .map((o) => o.package)
      .filter((p) => p.name.includes("rulebound") || p.keywords?.includes("rulebound"))

    if (packages.length === 0) {
      console.log(chalk.dim("No packages found."))
      console.log(chalk.dim("Try: rulebound registry search @rulebound/rules"))
      return
    }

    for (const pkg of packages) {
      console.log(`  ${chalk.white(pkg.name)} ${chalk.dim(`v${pkg.version}`)}`)
      if (pkg.description) console.log(`  ${chalk.dim(pkg.description)}`)
      console.log()
    }

    console.log(chalk.dim(`Found ${packages.length} package(s).`))
    console.log(chalk.dim(`Install with: rulebound registry install <package>`))
  } catch (error) {
    console.error(chalk.red("Search failed:"), error instanceof Error ? error.message : String(error))
  }
}

export async function registryInstallCommand(packageName: string): Promise<void> {
  console.log()
  console.log(chalk.white(`Installing ${packageName}...`))

  try {
    const pm = detectPackageManager()
    const installCmd = pm === "pnpm" ? `pnpm add -D ${packageName}` : `npm install -D ${packageName}`
    execSync(installCmd, { stdio: "inherit", cwd: process.cwd() })

    addToConfig(packageName)
    console.log()
    console.log(chalk.white(`Installed ${packageName} and added to .rulebound/config.json extends.`))
    console.log(chalk.dim("Run 'rulebound rules list' to see the new rules."))
  } catch (error) {
    console.error(chalk.red("Install failed:"), error instanceof Error ? error.message : String(error))
  }
}

export async function registryListCommand(): Promise<void> {
  const cwd = process.cwd()
  const nodeModulesDir = join(cwd, "node_modules", "@rulebound")

  console.log()
  console.log(chalk.white("INSTALLED RULE PACKAGES"))
  console.log(chalk.dim("\u2500".repeat(50)))
  console.log()

  if (!existsSync(nodeModulesDir)) {
    console.log(chalk.dim("No @rulebound packages installed."))
    return
  }

  const entries = readdirSync(nodeModulesDir).filter((e) => e.startsWith("rules-"))
  if (entries.length === 0) {
    console.log(chalk.dim("No rule packages found in @rulebound scope."))
    return
  }

  for (const entry of entries) {
    const pkgJsonPath = join(nodeModulesDir, entry, "package.json")
    if (!existsSync(pkgJsonPath)) continue

    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"))
    const rulesDir = resolveRulesDir(join(nodeModulesDir, entry), pkgJson)
    const ruleCount = rulesDir ? countRules(rulesDir) : 0

    console.log(`  ${chalk.white(`@rulebound/${entry}`)} ${chalk.dim(`v${pkgJson.version}`)}`)
    console.log(`  ${chalk.dim(pkgJson.description ?? "")}`)
    console.log(`  ${chalk.dim(`${ruleCount} rule(s)`)}`)
    console.log()
  }
}

export async function registryInfoCommand(packageName: string): Promise<void> {
  const cwd = process.cwd()
  const pkgDir = resolve(cwd, "node_modules", packageName)

  if (!existsSync(pkgDir)) {
    console.log(chalk.red(`Package ${packageName} is not installed.`))
    console.log(chalk.dim(`Install with: rulebound registry install ${packageName}`))
    return
  }

  const pkgJsonPath = join(pkgDir, "package.json")
  if (!existsSync(pkgJsonPath)) {
    console.log(chalk.red(`No package.json found for ${packageName}.`))
    return
  }

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"))
  const rulesDir = resolveRulesDir(pkgDir, pkgJson)

  console.log()
  console.log(chalk.white(packageName))
  console.log(chalk.dim("\u2500".repeat(50)))
  console.log(`  ${chalk.dim("Version:")}     ${pkgJson.version}`)
  console.log(`  ${chalk.dim("Description:")} ${pkgJson.description ?? "N/A"}`)
  console.log(`  ${chalk.dim("Keywords:")}    ${(pkgJson.keywords ?? []).join(", ")}`)
  console.log()

  if (rulesDir && existsSync(rulesDir)) {
    const rules = collectMarkdownFiles(rulesDir)
    console.log(chalk.white(`  RULES (${rules.length})`))
    console.log(chalk.dim("  " + "\u2500".repeat(46)))
    for (const file of rules) {
      const content = readFileSync(file, "utf-8")
      const titleMatch = content.match(/^title:\s*(.+)$/m)
      const categoryMatch = content.match(/^category:\s*(.+)$/m)
      const title = titleMatch?.[1] ?? file.split("/").pop()?.replace(".md", "") ?? "Unknown"
      const category = categoryMatch?.[1] ?? "general"
      console.log(`  ${chalk.white(title)} ${chalk.dim(`[${category}]`)}`)
    }
  }
  console.log()
}

function detectPackageManager(): "pnpm" | "npm" {
  if (existsSync(join(process.cwd(), "pnpm-lock.yaml"))) return "pnpm"
  return "npm"
}

function addToConfig(packageName: string): void {
  const configPath = resolve(process.cwd(), ".rulebound", "config.json")
  if (!existsSync(configPath)) return

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"))
    const extends_ = config.extends ?? []
    if (!extends_.includes(packageName)) {
      extends_.push(packageName)
      config.extends = extends_
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
    }
  } catch {
    // Config parse failed, skip
  }
}

function resolveRulesDir(pkgDir: string, pkgJson: Record<string, unknown>): string | null {
  const ruleboundConfig = pkgJson.rulebound as { rulesDir?: string } | undefined
  if (ruleboundConfig?.rulesDir) {
    const dir = join(pkgDir, ruleboundConfig.rulesDir)
    if (existsSync(dir)) return dir
  }

  const candidates = [
    join(pkgDir, "rules"),
    join(pkgDir, ".rulebound", "rules"),
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  return null
}

function countRules(dir: string): number {
  return collectMarkdownFiles(dir).length
}

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = []
  function walk(current: string) {
    const entries = readdirSync(current)
    for (const entry of entries) {
      const full = join(current, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) walk(full)
      else if (entry.endsWith(".md")) files.push(full)
    }
  }
  walk(dir)
  return files
}
