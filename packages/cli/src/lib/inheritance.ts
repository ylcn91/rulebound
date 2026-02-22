import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import type { LocalRule, ProjectConfig } from "./local-rules.js"
import { loadLocalRules, findRulesDir } from "./local-rules.js"

export interface RuleboundConfig {
  project?: ProjectConfig & { name?: string }
  agents?: string[]
  rulesDir?: string
  extends?: string[]
  // Legacy flat fields
  projectName?: string
}

export function loadConfig(cwd: string): RuleboundConfig | null {
  const configPath = resolve(cwd, ".rulebound", "config.json")
  if (!existsSync(configPath)) return null

  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as RuleboundConfig
  } catch {
    return null
  }
}

export function getProjectConfig(cwd: string): ProjectConfig | null {
  const config = loadConfig(cwd)
  if (!config?.project) return null
  return {
    name: config.project.name,
    stack: config.project.stack,
    scope: config.project.scope,
    team: config.project.team,
  }
}

/**
 * Load rules with inheritance support.
 * 
 * Config example:
 * {
 *   "project": { "name": "auth-service", "stack": ["java", "spring-boot"], "scope": ["backend"], "team": "backend" },
 *   "extends": ["../shared-rules/.rulebound/rules", "@company/rules"],
 *   "rulesDir": ".rulebound/rules"
 * }
 * 
 * Base rules are loaded first, then local rules override by ID.
 */
export function loadRulesWithInheritance(cwd: string, overrideDir?: string): LocalRule[] {
  const config = loadConfig(cwd)

  // Collect base rules from extended paths
  const baseRules: Map<string, LocalRule> = new Map()

  if (config?.extends) {
    for (const extendPath of config.extends) {
      const resolvedPath = resolveExtendPath(cwd, extendPath)
      if (resolvedPath && existsSync(resolvedPath)) {
        const extRules = loadLocalRules(resolvedPath)
        for (const rule of extRules) {
          baseRules.set(rule.id, { ...rule, filePath: `[inherited] ${rule.filePath}` })
        }
      }
    }
  }

  // Load local rules
  const localDir = overrideDir ?? findRulesDir(cwd)
  if (localDir) {
    const localRules = loadLocalRules(localDir)
    for (const rule of localRules) {
      // Local rules override inherited ones with same ID
      baseRules.set(rule.id, rule)
    }
  }

  return [...baseRules.values()]
}

function resolveExtendPath(cwd: string, extendPath: string): string | null {
  // Relative path
  if (extendPath.startsWith(".") || extendPath.startsWith("/")) {
    return resolve(cwd, extendPath)
  }

  // Package-style path (e.g., @company/rules)
  const nmPath = resolve(cwd, "node_modules", extendPath, "rules")
  if (existsSync(nmPath)) return nmPath

  const nmRuleboundPath = resolve(cwd, "node_modules", extendPath, ".rulebound", "rules")
  if (existsSync(nmRuleboundPath)) return nmRuleboundPath

  return null
}
