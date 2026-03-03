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

export function loadGatewayConfig(): GatewayConfig {
  return {
    ...DEFAULT_CONFIG,
    port: parseInt(process.env.GATEWAY_PORT ?? String(DEFAULT_CONFIG.port), 10),
    ruleboundServerUrl: process.env.RULEBOUND_SERVER_URL ?? DEFAULT_CONFIG.ruleboundServerUrl,
    ruleboundApiKey: process.env.RULEBOUND_API_KEY ?? DEFAULT_CONFIG.ruleboundApiKey,
    enforcement: (process.env.RULEBOUND_ENFORCEMENT ?? DEFAULT_CONFIG.enforcement) as GatewayConfig["enforcement"],
    injectRules: process.env.RULEBOUND_INJECT_RULES !== "false",
    scanResponses: process.env.RULEBOUND_SCAN_RESPONSES !== "false",
    auditLog: process.env.RULEBOUND_AUDIT_LOG !== "false",
    project: process.env.RULEBOUND_PROJECT,
    stack: process.env.RULEBOUND_STACK?.split(",").map((s) => s.trim()),
    targets: {
      openai: process.env.OPENAI_TARGET_URL ?? DEFAULT_CONFIG.targets.openai,
      anthropic: process.env.ANTHROPIC_TARGET_URL ?? DEFAULT_CONFIG.targets.anthropic,
      google: process.env.GOOGLE_TARGET_URL ?? DEFAULT_CONFIG.targets.google,
    },
  }
}
