import { Hono } from "hono"
import type { GatewayConfig } from "./config.js"
import { getCachedRules } from "./rule-cache.js"
import { logger } from "./logger.js"
import {
  buildRuleInjectionText,
  injectRulesOpenAI,
  injectRulesAnthropic,
} from "./interceptor/pre-request.js"
import { scanResponse, buildViolationWarning } from "./interceptor/post-response.js"
import { StreamScanner } from "./interceptor/stream-scanner.js"

type Provider = "openai" | "anthropic" | "google"

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

export function createProxy(config: GatewayConfig) {
  const app = new Hono()

  app.get("/health", (c) => c.json({ status: "ok", type: "gateway", version: "0.1.0" }))

  app.all("/*", async (c) => {
    const path = c.req.path
    const provider = detectProvider(path)
    const targetBase = getTargetUrl(config, provider)

    if (!targetBase) {
      return c.json({ error: `No target configured for provider: ${provider}` }, 502)
    }

    const targetPath = stripProviderPrefix(path)
    const targetUrl = `${targetBase}${targetPath}`

    const isChat = targetPath.includes("/chat/completions") || targetPath.includes("/messages")
    const method = c.req.method

    if (method !== "POST" || !isChat) {
      const response = await fetch(targetUrl, {
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
    const isStreaming = body.stream === true

    // Pre-request: inject rules
    if (config.injectRules) {
      const rules = await getCachedRules(config)
      if (rules.length > 0) {
        const ruleText = buildRuleInjectionText(rules)
        if (provider === "anthropic") {
          body = injectRulesAnthropic(body, ruleText)
        } else {
          body = injectRulesOpenAI(body, ruleText)
        }
      }
    }

    const targetResponse = await fetch(targetUrl, {
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
      return handleStreamingResponse(targetResponse, config)
    }

    // Non-streaming response — scan for violations
    const responseBody = await targetResponse.text()

    if (config.scanResponses) {
      const rules = await getCachedRules(config)
      if (rules.length > 0) {
        try {
          const parsed = JSON.parse(responseBody)
          const content = extractResponseContent(parsed, provider)

          if (content) {
            const scanResult = await scanResponse(content, rules)

            if (scanResult.hasViolations) {
              const warning = buildViolationWarning(scanResult.violations)

              if (config.enforcement === "strict") {
                return c.json({
                  error: {
                    message: "Rulebound: Code violations detected. Request blocked.",
                    type: "rulebound_violation",
                    violations: scanResult.violations,
                  },
                }, 422)
              }

              // Advisory/moderate: append warning to response
              const modified = appendWarningToResponse(parsed, provider, warning)
              return c.json(modified)
            }
          }
        } catch (error) {
          logger.warn("Failed to parse response for violation scanning", {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }

    return new Response(responseBody, {
      status: targetResponse.status,
      headers: passthroughHeaders(targetResponse.headers),
    })
  })

  return app
}

async function handleStreamingResponse(
  targetResponse: Response,
  config: GatewayConfig
): Promise<Response> {
  const rules = config.scanResponses ? await getCachedRules(config) : []

  const scanner = new StreamScanner({
    rules,
    enforcement: config.enforcement,
  })

  const reader = targetResponse.body!.getReader()
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()

      if (done) {
        // End of stream — do final scan
        if (config.scanResponses && scanner.hasCompleteCodeBlock()) {
          const { hasViolations, warning } = await scanner.scanAccumulated()
          if (hasViolations && warning) {
            const warningEvent = `data: ${JSON.stringify({
              choices: [{
                delta: { content: `\n\n${warning}` },
                finish_reason: null,
              }],
            })}\n\n`
            controller.enqueue(encoder.encode(warningEvent))
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
        return
      }

      const chunk = decoder.decode(value, { stream: true })
      scanner.appendChunk(extractContentFromSSE(chunk))
      controller.enqueue(value)
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

function extractContentFromSSE(chunk: string): string {
  const lines = chunk.split("\n").filter((l) => l.startsWith("data: "))
  let content = ""

  for (const line of lines) {
    const data = line.slice(6)
    if (data === "[DONE]") continue
    try {
      const parsed = JSON.parse(data)
      const delta = parsed.choices?.[0]?.delta?.content ?? parsed.delta?.text ?? ""
      content += delta
    } catch (error) {
      logger.debug("Failed to parse SSE chunk", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return content
}

function extractResponseContent(body: Record<string, unknown>, provider: Provider): string | null {
  if (provider === "anthropic") {
    const content = body.content as Array<{ type: string; text?: string }> | undefined
    if (content) return content.map((c) => c.text ?? "").join("\n")
  }

  const choices = body.choices as Array<{ message?: { content?: string } }> | undefined
  if (choices?.[0]?.message?.content) return choices[0].message.content

  return null
}

function appendWarningToResponse(
  body: Record<string, unknown>,
  provider: Provider,
  warning: string
): Record<string, unknown> {
  if (provider === "anthropic") {
    const content = body.content as Array<{ type: string; text?: string }> | undefined
    if (content) {
      return {
        ...body,
        content: [...content, { type: "text", text: warning }],
      }
    }
  }

  const choices = body.choices as Array<{ message?: { content?: string }; [key: string]: unknown }> | undefined
  if (choices?.[0]?.message?.content) {
    const modifiedChoices = [...choices]
    modifiedChoices[0] = {
      ...modifiedChoices[0],
      message: {
        ...modifiedChoices[0].message,
        content: modifiedChoices[0].message!.content + warning,
      },
    }
    return { ...body, choices: modifiedChoices }
  }

  return body
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
    if (lower === "transfer-encoding" || lower === "connection") return
    result.set(key, value)
  })
  return result
}
