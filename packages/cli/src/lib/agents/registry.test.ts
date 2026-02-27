import { describe, it, expect } from "vitest"
import { parseAgentsConfig, resolveAgentRules, type AgentProfile } from "./registry.js"

describe("parseAgentsConfig", () => {
  it("parses valid agents config", () => {
    const raw = {
      agents: {
        claude: { roles: ["architect"], rules: ["all"], enforcement: "strict" },
        codex: { rules: ["security/*"], enforcement: "moderate" },
      },
    }
    const agents = parseAgentsConfig(raw)
    expect(agents).toHaveLength(2)
    expect(agents[0].name).toBe("claude")
    expect(agents[0].roles).toContain("architect")
    expect(agents[1].name).toBe("codex")
    expect(agents[1].roles).toEqual([])
  })

  it("returns empty array for invalid config", () => {
    expect(parseAgentsConfig(null)).toEqual([])
    expect(parseAgentsConfig({})).toEqual([])
    expect(parseAgentsConfig({ agents: "invalid" })).toEqual([])
  })
})

describe("resolveAgentRules", () => {
  it("returns all rules when agent has 'all'", () => {
    const agent: AgentProfile = { name: "claude", roles: [], rules: ["all"], enforcement: "strict" }
    const allRuleIds = ["global.auth", "security.secrets", "style.css"]
    expect(resolveAgentRules(agent, allRuleIds)).toEqual(allRuleIds)
  })

  it("filters rules by glob pattern", () => {
    const agent: AgentProfile = { name: "admin", roles: ["security"], rules: ["security/*", "global/*"], enforcement: "strict" }
    const allRuleIds = ["global.auth", "security.secrets", "style.css", "security.input"]
    const resolved = resolveAgentRules(agent, allRuleIds)
    expect(resolved).toContain("global.auth")
    expect(resolved).toContain("security.secrets")
    expect(resolved).toContain("security.input")
    expect(resolved).not.toContain("style.css")
  })
})
