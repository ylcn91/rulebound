import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

export interface AgentProfile {
  readonly name: string
  readonly roles: readonly string[]
  readonly rules: readonly string[]
  readonly enforcement: "advisory" | "moderate" | "strict"
}

const VALID_ENFORCEMENT = new Set(["advisory", "moderate", "strict"])

export function parseAgentsConfig(raw: unknown): AgentProfile[] {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return []
  }

  const record = raw as Record<string, unknown>
  const agents = record.agents

  if (agents === null || agents === undefined || typeof agents !== "object" || Array.isArray(agents)) {
    return []
  }

  const entries = Object.entries(agents as Record<string, unknown>)

  return entries.map(([name, value]) => {
    const config = (typeof value === "object" && value !== null) ? value as Record<string, unknown> : {}

    const roles = Array.isArray(config.roles)
      ? config.roles.filter((r): r is string => typeof r === "string")
      : []

    const rules = Array.isArray(config.rules)
      ? config.rules.filter((r): r is string => typeof r === "string")
      : ["all"]

    const enforcement = typeof config.enforcement === "string" && VALID_ENFORCEMENT.has(config.enforcement)
      ? (config.enforcement as AgentProfile["enforcement"])
      : "advisory"

    return { name, roles, rules, enforcement }
  })
}

export function loadAgentsConfig(cwd: string): AgentProfile[] {
  const configPath = resolve(cwd, ".rulebound", "agents.json")

  if (!existsSync(configPath)) {
    return []
  }

  try {
    const content = readFileSync(configPath, "utf-8")
    const parsed: unknown = JSON.parse(content)
    return parseAgentsConfig(parsed)
  } catch {
    return []
  }
}

export function resolveAgentRules(agent: AgentProfile, allRuleIds: string[]): string[] {
  if (agent.rules.includes("all")) {
    return [...allRuleIds]
  }

  return allRuleIds.filter((ruleId) =>
    agent.rules.some((pattern) => {
      if (pattern.endsWith("/*")) {
        const prefix = pattern.slice(0, -2) + "."
        return ruleId.startsWith(prefix)
      }
      return ruleId === pattern
    })
  )
}
