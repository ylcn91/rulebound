import { Hono } from "hono"
import type { GatewayConfig } from "./config.js"
import { getCachedRules } from "./rule-cache.js"
import { logger } from "./logger.js"
import { buildRuleInjectionText } from "./interceptor/pre-request.js"
import {
  recordGatewayValidationTelemetry,
  shouldBlockForMode,
} from "./interceptor/enforcement.js"
import { scanResponse, buildViolationWarning } from "./interceptor/post-response.js"
import { StreamScanner } from "./interceptor/stream-scanner.js"
import {
  appendWarningToResponse,
  buildStreamViolationEvent,
  buildStreamWarningMessage,
  extractContentFromSSE,
  extractResponseContent,
  getStreamTerminator,
  injectRulesForProvider,
  isGenerationRequest,
  isStreamingRequest,
  type Provider,
} from "./provider-adapter.js"

function detectProvider(path: string): Provider {
  if (path.startsWith("/anthropic") || path.startsWith("/v1/messages")) return "anthropic"
  if (path.startsWith("/google")) return "google"
  return "openai"
}

function stripProviderPrefix(path: string): string {
  if (path.startsWith("/openai")) return path.slice(7)
  if (path.startsWith("/anthropic")) return path.slice(10)
  if (path.startsWith("/google")) return path.slice(7)
  return path
}

function getTargetUrl(config: GatewayConfig, provider: Provider): string | undefined {
  return config.targets[provider]
}

function extractSystemPrompt(provider: Provider, body: Record<string, unknown>): string {
  if (provider === "anthropic") {
    const sys = body.system
    if (typeof sys === "string") return sys.slice(0, 500)
    if (Array.isArray(sys)) {
      return (sys as Array<{ text?: string }>)
        .map((b) => b.text ?? "")
        .join(" ")
        .slice(0, 500)
    }
  }
  if (provider === "openai") {
    const messages = body.messages as Array<{ role: string; content: string }> | undefined
    const sysMsg = messages?.find((m) => m.role === "system")
    return sysMsg?.content?.slice(0, 500) ?? ""
  }
  return ""
}

function extractUserPrompt(provider: Provider, body: Record<string, unknown>): string {
  const messages = body.messages as Array<{ role: string; content: unknown }> | undefined
  if (!messages) return ""
  const last = [...messages].reverse().find((m) => m.role === "user")
  if (!last) return ""
  if (typeof last.content === "string") return last.content.slice(0, 300)
  if (Array.isArray(last.content)) {
    return (last.content as Array<{ text?: string }>)
      .filter((b) => b.text)
      .map((b) => b.text)
      .join(" ")
      .slice(0, 300)
  }
  return ""
}

export function createProxy(config: GatewayConfig) {
  const app = new Hono()
  let requestCounter = 0

  app.get("/health", (c) => c.json({ status: "ok", type: "gateway", version: "0.1.0" }))

  app.all("/*", async (c) => {
    const path = c.req.path
    const provider = detectProvider(path)
    const targetBase = getTargetUrl(config, provider)
    const reqId = ++requestCounter

    if (!targetBase) {
      return c.json({ error: `No target configured for provider: ${provider}` }, 502)
    }

    const targetPath = stripProviderPrefix(path)
    const targetUrl = new URL(targetPath, targetBase)
    const requestUrl = new URL(c.req.url)
    targetUrl.search = requestUrl.search

    const isChat = isGenerationRequest(provider, targetPath)
    const method = c.req.method

    if (method !== "POST" || !isChat) {
      logger.info("Passthrough request", { reqId, method, path: targetPath })
      const response = await fetch(targetUrl.toString(), {
        method,
        headers: forwardHeaders(c.req.raw.headers, targetBase),
        body: method !== "GET" && method !== "HEAD" ? c.req.raw.body : undefined,
        // @ts-expect-error duplex required for streaming body
        duplex: "half",
      })
      return new Response(response.body, {
        status: response.status,
        headers: passthroughHeaders(response.headers),
      })
    }

    // Chat/messages endpoint — apply rule injection + response scanning
    let body = await c.req.json()
    const isStreaming = isStreamingRequest(provider, targetPath, body)
    const model = (body as Record<string, unknown>).model as string | undefined

    logger.info("Chat request received", {
      reqId,
      provider,
      model: model ?? "unknown",
      streaming: isStreaming,
      userPrompt: extractUserPrompt(provider, body),
    })

    // Pre-request: inject rules
    if (config.injectRules) {
      const rules = await getCachedRules(config)
      if (rules.length > 0) {
        const ruleText = buildRuleInjectionText(rules)
        body = injectRulesForProvider(provider, body, ruleText)
        logger.info("Rules injected", {
          reqId,
          rulesCount: rules.length,
          ruleTextLength: ruleText.length,
          systemPromptPreview: extractSystemPrompt(provider, body),
        })
      }
    }

    const targetResponse = await fetch(targetUrl.toString(), {
      method: "POST",
      headers: forwardHeaders(c.req.raw.headers, targetBase),
      body: JSON.stringify(body),
    })

    if (!targetResponse.ok || !targetResponse.body) {
      return new Response(targetResponse.body, {
        status: targetResponse.status,
        headers: passthroughHeaders(targetResponse.headers),
      })
    }

    // Streaming response
    if (isStreaming) {
      logger.info("Streaming response started", { reqId, provider, model: model ?? "unknown" })
      return handleStreamingResponse(targetResponse, config, provider, reqId, model)
    }

    // Non-streaming response — scan for violations
    const responseBody = await targetResponse.text()

    logger.info("Response received", {
      reqId,
      provider,
      model: model ?? "unknown",
      status: targetResponse.status,
      contentLength: responseBody.length,
      responseBody: responseBody.length <= 10000 ? responseBody : responseBody.slice(0, 10000) + "... [truncated]",
    })

    if (config.scanResponses) {
      const rules = await getCachedRules(config)
      try {
        const parsed = JSON.parse(responseBody)
        const content = extractResponseContent(provider, parsed)

        if (content) {
          logger.info("Response content extracted", {
            reqId,
            contentPreview: content.slice(0, 500),
            contentLength: content.length,
          })

          const scanResult = await scanResponse(content, rules)

          logger.info("Violation scan complete", {
            reqId,
            codeBlockCount: scanResult.codeBlockCount,
            hasViolations: scanResult.hasViolations,
            violationCount: scanResult.violations.length,
            violations: scanResult.violations.map((v) => ({
              ruleId: v.ruleId,
              ruleTitle: v.ruleTitle,
              severity: v.severity,
              reason: v.reason,
            })),
          })

          if (scanResult.codeBlockCount > 0) {
            recordGatewayValidationTelemetry({
              report: scanResult.report,
              violations: scanResult.violations,
              enforcement: scanResult.enforcement,
              rulesTotal: scanResult.report?.rulesTotal ?? rules.length,
              task: "Gateway non-streaming response validation",
              project: config.project,
            })
          }

          if (scanResult.hasViolations) {
            const warning = buildViolationWarning(scanResult.violations)

            if (shouldBlockForMode(config.enforcement, scanResult.enforcement)) {
              logger.warn("Request BLOCKED due to violations", {
                reqId,
                provider,
                model: model ?? "unknown",
                enforcement: config.enforcement,
                violationCount: scanResult.violations.length,
                violations: scanResult.violations,
              })
              return c.json({
                error: {
                  message: "Rulebound: Code violations detected. Request blocked.",
                  type: "rulebound_violation",
                  violations: scanResult.violations,
                },
              }, 422)
            }

            logger.warn("Violations detected, warning appended", {
              reqId,
              provider,
              model: model ?? "unknown",
              violationCount: scanResult.violations.length,
            })

            const modified = appendWarningToResponse(provider, parsed, warning)
            return c.json(modified)
          }
        }
      } catch (error) {
        logger.warn("Failed to parse response for violation scanning", {
          reqId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info("Response forwarded (clean)", { reqId, status: targetResponse.status })

    return new Response(responseBody, {
      status: targetResponse.status,
      headers: passthroughHeaders(targetResponse.headers),
    })
  })

  return app
}

async function handleStreamingResponse(
  targetResponse: Response,
  config: GatewayConfig,
  provider: Provider,
  reqId: number,
  model: string | undefined,
): Promise<Response> {
  const rules = config.scanResponses ? await getCachedRules(config) : []

  const scanner = new StreamScanner({
    rules,
    enforcement: config.enforcement,
  })

  const reader = targetResponse.body!.getReader()
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  let streamChunkCount = 0

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()

      if (done) {
        const fullBuffer = scanner.getBuffer()
        logger.info("Stream completed", {
          reqId,
          provider,
          model: model ?? "unknown",
          totalChunks: streamChunkCount,
          accumulatedContentLength: fullBuffer.length,
          responseContent: fullBuffer.length <= 10000 ? fullBuffer : fullBuffer.slice(0, 10000) + "... [truncated]",
        })
        controller.close()
        return
      }

      streamChunkCount++
      const chunk = decoder.decode(value, { stream: true })
      scanner.appendChunk(extractContentFromSSE(provider, chunk))

      const shouldBufferChunk = scanner.isInsideOpenCodeBlock() || scanner.hasPendingRawChunks()
      if (shouldBufferChunk) {
        scanner.appendRawChunk(value)
      } else {
        controller.enqueue(value)
      }

      if (!config.scanResponses || !scanner.hasCompleteCodeBlock()) {
        return
      }

      const result = await scanner.scanAccumulated()
      if (!result.scanResult) {
        return
      }

      logger.info("Stream violation scan complete", {
        reqId,
        provider,
        model: model ?? "unknown",
        codeBlockCount: result.scanResult.codeBlockCount,
        hasViolations: result.scanResult.hasViolations,
        violationCount: result.scanResult.violations.length,
        action: result.action,
        violations: result.scanResult.violations.map((v) => ({
          ruleId: v.ruleId,
          ruleTitle: v.ruleTitle,
          severity: v.severity,
          reason: v.reason,
        })),
      })

      recordGatewayValidationTelemetry({
        report: result.scanResult.report,
        violations: result.scanResult.violations,
        enforcement: result.scanResult.enforcement,
        rulesTotal: result.scanResult.report?.rulesTotal ?? rules.length,
        task: "Gateway streaming response validation",
        project: config.project,
      })

      if (result.action === "warn" && result.warning) {
        logger.warn("Stream violations detected, warning injected", {
          reqId,
          provider,
          model: model ?? "unknown",
          violationCount: result.scanResult.violations.length,
        })
        for (const pendingChunk of scanner.consumePendingRawChunks()) {
          controller.enqueue(pendingChunk)
        }
        controller.enqueue(encoder.encode(buildStreamWarningMessage(provider, result.warning)))
        return
      }

      if (result.action === "block" && result.warning) {
        logger.warn("Stream BLOCKED due to violations", {
          reqId,
          provider,
          model: model ?? "unknown",
          enforcement: config.enforcement,
          violationCount: result.scanResult.violations.length,
          violations: result.scanResult.violations,
        })
        scanner.consumePendingRawChunks()
        const blockingMode = config.enforcement === "moderate" ? "moderate" : "strict"
        controller.enqueue(encoder.encode(buildStreamViolationEvent(result.warning, blockingMode)))
        controller.enqueue(encoder.encode(buildStreamWarningMessage(provider, result.warning)))
        const terminator = getStreamTerminator(provider)
        if (terminator.length > 0) {
          controller.enqueue(encoder.encode(terminator))
        }
        await reader.cancel("rulebound_violation")
        controller.close()
        scanner.reset()
        return
      }

      if (result.action === "pass") {
        for (const pendingChunk of scanner.consumePendingRawChunks()) {
          controller.enqueue(pendingChunk)
        }
      }
    },
  })

  return new Response(stream, {
    status: targetResponse.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}

function forwardHeaders(headers: Headers, targetBase: string): Headers {
  const forwarded = new Headers()
  headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (lower === "host" || lower === "content-length") return
    forwarded.set(key, value)
  })

  const url = new URL(targetBase)
  forwarded.set("Host", url.host)
  return forwarded
}

function passthroughHeaders(headers: Headers): Headers {
  const result = new Headers()
  headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (lower === "transfer-encoding" || lower === "connection" || lower === "content-encoding" || lower === "content-length") return
    result.set(key, value)
  })
  return result
}
