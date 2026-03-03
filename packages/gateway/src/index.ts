import { serve } from "@hono/node-server"
import { createProxy } from "./proxy.js"
import { loadGatewayConfig } from "./config.js"

export { createProxy } from "./proxy.js"
export { loadGatewayConfig, DEFAULT_CONFIG } from "./config.js"
export type { GatewayConfig } from "./config.js"
export { getCachedRules, invalidateCache } from "./rule-cache.js"
export { buildRuleInjectionText, injectRulesOpenAI, injectRulesAnthropic } from "./interceptor/pre-request.js"
export { scanResponse, extractCodeBlocks, buildViolationWarning } from "./interceptor/post-response.js"
export type { ScanResult } from "./interceptor/post-response.js"
export { StreamScanner } from "./interceptor/stream-scanner.js"
export type { StreamScannerConfig } from "./interceptor/stream-scanner.js"

const isDirectRun = process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts")

if (isDirectRun) {
  const config = loadGatewayConfig()
  const app = createProxy(config)

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`Rulebound Gateway running on http://localhost:${info.port}`)
    console.log()
    console.log("Route your AI tools through this gateway:")
    console.log(`  OpenAI:    OPENAI_API_BASE=http://localhost:${info.port}/openai/v1`)
    console.log(`  Anthropic: ANTHROPIC_API_BASE=http://localhost:${info.port}/anthropic`)
    console.log()
    console.log(`Enforcement: ${config.enforcement}`)
    console.log(`Rule injection: ${config.injectRules ? "enabled" : "disabled"}`)
    console.log(`Response scanning: ${config.scanResponses ? "enabled" : "disabled"}`)

    if (config.ruleboundServerUrl) {
      console.log(`Server: ${config.ruleboundServerUrl}`)
    }
  })
}
