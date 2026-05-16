import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { loadGatewayConfig } from "../config.js"

const CONFIG_ENV_KEYS = [
  "GATEWAY_PORT",
  "RULEBOUND_SERVER_URL",
  "RULEBOUND_API_KEY",
  "RULEBOUND_ENFORCEMENT",
  "RULEBOUND_INJECT_RULES",
  "RULEBOUND_SCAN_RESPONSES",
  "RULEBOUND_AUDIT_LOG",
  "RULEBOUND_PROJECT",
  "RULEBOUND_STACK",
  "OPENAI_TARGET_URL",
  "ANTHROPIC_TARGET_URL",
  "GOOGLE_TARGET_URL",
] as const

const originalEnv = new Map<string, string | undefined>()

describe("gateway config validation", () => {
  beforeEach(() => {
    for (const key of CONFIG_ENV_KEYS) {
      originalEnv.set(key, process.env[key])
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of CONFIG_ENV_KEYS) {
      const value = originalEnv.get(key)
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    originalEnv.clear()
  })

  it("loads defaults and parses explicit valid values", () => {
    process.env.GATEWAY_PORT = "4500"
    process.env.RULEBOUND_SERVER_URL = "https://rulebound.example.com"
    process.env.RULEBOUND_ENFORCEMENT = "strict"
    process.env.RULEBOUND_INJECT_RULES = "0"
    process.env.RULEBOUND_SCAN_RESPONSES = "false"
    process.env.RULEBOUND_AUDIT_LOG = "true"
    process.env.RULEBOUND_STACK = "typescript, node "

    const config = loadGatewayConfig()

    expect(config.port).toBe(4500)
    expect(config.ruleboundServerUrl).toBe("https://rulebound.example.com")
    expect(config.enforcement).toBe("strict")
    expect(config.injectRules).toBe(false)
    expect(config.scanResponses).toBe(false)
    expect(config.auditLog).toBe(true)
    expect(config.stack).toEqual(["typescript", "node"])
  })

  it.each([
    ["GATEWAY_PORT", "NaN"],
    ["GATEWAY_PORT", "-1"],
    ["GATEWAY_PORT", "65536"],
    ["RULEBOUND_ENFORCEMENT", "block"],
    ["RULEBOUND_INJECT_RULES", "maybe"],
    ["RULEBOUND_SERVER_URL", "not-a-url"],
    ["OPENAI_TARGET_URL", "ftp://example.com"],
  ])("fails fast for invalid %s", (key, value) => {
    process.env[key] = value

    expect(() => loadGatewayConfig()).toThrow(`Invalid gateway config ${key}`)
  })
})
