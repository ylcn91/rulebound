import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import chalk from "chalk"
import { DEFAULT_ENFORCEMENT, type EnforcementConfig, type EnforcementMode } from "../lib/enforcement.js"

const VALID_MODES: readonly EnforcementMode[] = ["advisory", "moderate", "strict"]

interface EnforceOptions {
  mode?: string
  threshold?: string
}

function loadConfigFile(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) {
    return {}
  }
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>
  } catch {
    return {}
  }
}

function getEnforcementFromConfig(config: Record<string, unknown>): EnforcementConfig {
  const raw = config.enforcement as Partial<EnforcementConfig> | undefined
  return {
    mode: raw?.mode ?? DEFAULT_ENFORCEMENT.mode,
    scoreThreshold: raw?.scoreThreshold ?? DEFAULT_ENFORCEMENT.scoreThreshold,
    autoPromote: raw?.autoPromote ?? DEFAULT_ENFORCEMENT.autoPromote,
  }
}

function isValidMode(value: string): value is EnforcementMode {
  return VALID_MODES.includes(value as EnforcementMode)
}

export async function enforceCommand(options: EnforceOptions): Promise<void> {
  const cwd = process.cwd()
  const ruleboundDir = resolve(cwd, ".rulebound")
  const configPath = resolve(ruleboundDir, "config.json")

  const config = loadConfigFile(configPath)
  const current = getEnforcementFromConfig(config)

  const hasUpdates = options.mode !== undefined || options.threshold !== undefined

  if (!hasUpdates) {
    console.log()
    console.log(chalk.white("  Enforcement Configuration"))
    console.log(chalk.dim("  ========================"))
    console.log()
    console.log(`  Mode:            ${formatMode(current.mode)}`)
    console.log(`  Score threshold:  ${chalk.white(String(current.scoreThreshold))}`)
    console.log(`  Auto-promote:     ${current.autoPromote ? chalk.green("enabled") : chalk.dim("disabled")}`)
    console.log()
    console.log(chalk.dim("  Update with: rulebound enforce --mode <advisory|moderate|strict>"))
    console.log(chalk.dim("               rulebound enforce --threshold <0-100>"))
    console.log()
    return
  }

  const updated = { ...current }

  if (options.mode !== undefined) {
    if (!isValidMode(options.mode)) {
      console.error(chalk.red(`Invalid mode: "${options.mode}". Must be one of: ${VALID_MODES.join(", ")}`))
      process.exit(1)
    }
    updated.mode = options.mode
  }

  if (options.threshold !== undefined) {
    const threshold = Number(options.threshold)
    if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
      console.error(chalk.red(`Invalid threshold: "${options.threshold}". Must be a number between 0 and 100.`))
      process.exit(1)
    }
    updated.scoreThreshold = threshold
  }

  if (!existsSync(ruleboundDir)) {
    mkdirSync(ruleboundDir, { recursive: true })
  }

  const newConfig = { ...config, enforcement: updated }
  writeFileSync(configPath, JSON.stringify(newConfig, null, 2) + "\n")

  console.log()
  console.log(chalk.white("  Enforcement updated."))
  console.log()
  console.log(`  Mode:            ${formatMode(updated.mode)}`)
  console.log(`  Score threshold:  ${chalk.white(String(updated.scoreThreshold))}`)
  console.log(`  Auto-promote:     ${updated.autoPromote ? chalk.green("enabled") : chalk.dim("disabled")}`)
  console.log()
}

function formatMode(mode: EnforcementMode): string {
  switch (mode) {
    case "advisory":
      return chalk.green("advisory") + chalk.dim(" (never blocks)")
    case "moderate":
      return chalk.yellow("moderate") + chalk.dim(" (blocks on MUST violations + low score)")
    case "strict":
      return chalk.red("strict") + chalk.dim(" (blocks on any violation)")
  }
}
