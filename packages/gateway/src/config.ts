export interface GatewayConfig {
  readonly port: number
  readonly ruleboundServerUrl?: string
  readonly ruleboundApiKey?: string
  readonly targets: {
    readonly openai?: string
    readonly anthropic?: string
    readonly google?: string
  }
  readonly enforcement: "advisory" | "moderate" | "strict"
  readonly injectRules: boolean
  readonly scanResponses: boolean
  readonly auditLog: boolean
  readonly project?: string
  readonly stack?: string[]
}

export const DEFAULT_CONFIG: GatewayConfig = {
  port: 4000,
  targets: {
    openai: "https://api.openai.com",
    anthropic: "https://api.anthropic.com",
    google: "https://generativelanguage.googleapis.com",
  },
  enforcement: "advisory",
  injectRules: true,
  scanResponses: true,
  auditLog: true,
}

const ENFORCEMENT_MODES = ["advisory", "moderate", "strict"] as const
const HTTP_PROTOCOLS = new Set(["http:", "https:"])

function configError(name: string, value: string, expected: string): Error {
  return new Error(`Invalid gateway config ${name}=${JSON.stringify(value)}; expected ${expected}`)
}

function parsePort(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw configError("GATEWAY_PORT", value, "an integer port from 0 to 65535")
  }

  const port = Number(value)
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw configError("GATEWAY_PORT", value, "an integer port from 0 to 65535")
  }

  return port
}

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]
  if (value === undefined) return defaultValue
  if (value === "true" || value === "1") return true
  if (value === "false" || value === "0") return false
  throw configError(name, value, "\"true\", \"false\", \"1\", or \"0\"")
}

function parseEnforcement(value: string): GatewayConfig["enforcement"] {
  if (ENFORCEMENT_MODES.includes(value as GatewayConfig["enforcement"])) {
    return value as GatewayConfig["enforcement"]
  }
  throw configError("RULEBOUND_ENFORCEMENT", value, ENFORCEMENT_MODES.join(" | "))
}

function validateHttpUrl(name: string, value: string | undefined): string | undefined {
  if (value === undefined) return undefined

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw configError(name, value, "an absolute http(s) URL")
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw configError(name, value, "an absolute http(s) URL")
  }

  return value
}

function parseStack(value: string | undefined): string[] | undefined {
  const stack = value
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  return stack && stack.length > 0 ? stack : undefined
}

export function loadGatewayConfig(): GatewayConfig {
  return {
    ...DEFAULT_CONFIG,
    port: parsePort(process.env.GATEWAY_PORT ?? String(DEFAULT_CONFIG.port)),
    ruleboundServerUrl: validateHttpUrl(
      "RULEBOUND_SERVER_URL",
      process.env.RULEBOUND_SERVER_URL ?? DEFAULT_CONFIG.ruleboundServerUrl,
    ),
    ruleboundApiKey: process.env.RULEBOUND_API_KEY ?? DEFAULT_CONFIG.ruleboundApiKey,
    enforcement: parseEnforcement(process.env.RULEBOUND_ENFORCEMENT ?? DEFAULT_CONFIG.enforcement),
    injectRules: parseBooleanEnv("RULEBOUND_INJECT_RULES", DEFAULT_CONFIG.injectRules),
    scanResponses: parseBooleanEnv("RULEBOUND_SCAN_RESPONSES", DEFAULT_CONFIG.scanResponses),
    auditLog: parseBooleanEnv("RULEBOUND_AUDIT_LOG", DEFAULT_CONFIG.auditLog),
    project: process.env.RULEBOUND_PROJECT,
    stack: parseStack(process.env.RULEBOUND_STACK),
    targets: {
      openai: validateHttpUrl(
        "OPENAI_TARGET_URL",
        process.env.OPENAI_TARGET_URL ?? DEFAULT_CONFIG.targets.openai,
      ),
      anthropic: validateHttpUrl(
        "ANTHROPIC_TARGET_URL",
        process.env.ANTHROPIC_TARGET_URL ?? DEFAULT_CONFIG.targets.anthropic,
      ),
      google: validateHttpUrl(
        "GOOGLE_TARGET_URL",
        process.env.GOOGLE_TARGET_URL ?? DEFAULT_CONFIG.targets.google,
      ),
    },
  }
}
