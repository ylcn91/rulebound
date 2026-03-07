import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createProxy } from "../proxy.js"
import { invalidateCache } from "../rule-cache.js"
import type { GatewayConfig } from "../config.js"

vi.mock("../interceptor/ast-scanner.js", () => ({
  scanCodeBlockWithAST: vi.fn().mockResolvedValue([]),
  detectLanguageFromAnnotation: vi.fn().mockReturnValue(null),
}))

function makeConfig(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return {
    port: 0,
    targets: {
      openai: "http://mock-openai.test",
      anthropic: "http://mock-anthropic.test",
      google: "http://mock-google.test",
    },
    enforcement: "advisory",
    injectRules: false,
    scanResponses: false,
    auditLog: false,
    ...overrides,
  }
}

function openaiChatResponse(content: string) {
  return {
    choices: [{
      message: { role: "assistant", content },
      finish_reason: "stop",
    }],
  }
}

function anthropicResponse(content: string) {
  return {
    content: [{ type: "text", text: content }],
    stop_reason: "end_turn",
  }
}

describe("Gateway Integration", () => {
  beforeEach(() => {
    invalidateCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns health check", async () => {
    const app = createProxy(makeConfig())
    const res = await app.request("/health")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
    expect(body.type).toBe("gateway")
  })

  it("returns 502 when no target configured for provider", async () => {
    const app = createProxy(makeConfig({ targets: {} }))
    const res = await app.request("/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    })
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toContain("No target configured")
  })

  it("proxies non-chat endpoints without modification", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models: ["gpt-4"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", mockFetch)

    const app = createProxy(makeConfig())
    const res = await app.request("/openai/v1/models", { method: "GET" })
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = mockFetch.mock.calls[0][0]
    expect(url).toBe("http://mock-openai.test/v1/models")
  })

  it("detects OpenAI provider from path", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(openaiChatResponse("Hello")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", mockFetch)

    const app = createProxy(makeConfig())
    const res = await app.request("/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    })
    expect(res.status).toBe(200)
    const url = mockFetch.mock.calls[0][0]
    expect(url).toBe("http://mock-openai.test/v1/chat/completions")
  })

  it("detects Anthropic provider from path", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(anthropicResponse("Hello")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", mockFetch)

    const app = createProxy(makeConfig())
    const res = await app.request("/anthropic/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
      }),
    })
    expect(res.status).toBe(200)
    const url = mockFetch.mock.calls[0][0]
    expect(url).toBe("http://mock-anthropic.test/v1/messages")
  })

  describe("rule injection", () => {
    it("injects rules into OpenAI system prompt", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(openaiChatResponse("Done")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      vi.stubGlobal("fetch", mockFetch)

      const app = createProxy(makeConfig({
        injectRules: true,
        ruleboundServerUrl: "http://mock-server.test",
      }))

      const rulesResponse = {
        data: [
          { id: "r1", title: "No Secrets", content: "No hardcoded secrets", category: "security", severity: "error", modality: "must", tags: [] },
        ],
      }

      const originalFetch = mockFetch
      mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes("mock-server.test")) {
          return new Response(JSON.stringify(rulesResponse), { status: 200 })
        }
        return new Response(JSON.stringify(openaiChatResponse("Done")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      })

      const res = await app.request("/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Write code" }],
        }),
      })

      expect(res.status).toBe(200)
      const calls = mockFetch.mock.calls
      const chatCall = calls.find((c) => c[0].includes("chat/completions"))
      if (chatCall) {
        const sentBody = JSON.parse(chatCall[1]?.body as string)
        const systemMsg = sentBody.messages.find((m: { role: string }) => m.role === "system")
        expect(systemMsg).toBeDefined()
        expect(systemMsg.content).toContain("rulebound_rules")
        expect(systemMsg.content).toContain("No Secrets")
      }
    })
  })

  describe("response scanning", () => {
    it("passes clean responses through in advisory mode", async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("mock-server.test")) {
          return new Response(JSON.stringify({
            data: [{ id: "r1", title: "No Eval", content: "Never use eval()", category: "security", severity: "error", modality: "must", tags: [] }],
          }), { status: 200 })
        }
        return new Response(JSON.stringify(openaiChatResponse("Here is safe code: `const x = 1;`")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      })
      vi.stubGlobal("fetch", mockFetch)

      const app = createProxy(makeConfig({
        scanResponses: true,
        enforcement: "advisory",
        ruleboundServerUrl: "http://mock-server.test",
      }))

      const res = await app.request("/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Write safe code" }],
        }),
      })

      expect(res.status).toBe(200)
    })

    it("blocks violating responses in strict mode", async () => {
      const { scanCodeBlockWithAST } = await import("../interceptor/ast-scanner.js")
      const mockScan = vi.mocked(scanCodeBlockWithAST)
      mockScan.mockResolvedValue([{
        ruleTitle: "No eval()",
        severity: "error",
        reason: "AST pattern: eval() detected",
        line: 1,
        codeSnippet: "eval('code')",
      }])

      const { detectLanguageFromAnnotation } = await import("../interceptor/ast-scanner.js")
      vi.mocked(detectLanguageFromAnnotation).mockReturnValue("javascript")

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("mock-server.test")) {
          return new Response(JSON.stringify({
            data: [{ id: "r1", title: "No Eval", content: "Never use eval", category: "security", severity: "error", modality: "must", tags: [] }],
          }), { status: 200 })
        }
        return new Response(JSON.stringify(openaiChatResponse("```javascript\neval('code')\n```")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      })
      vi.stubGlobal("fetch", mockFetch)

      const app = createProxy(makeConfig({
        scanResponses: true,
        enforcement: "strict",
        ruleboundServerUrl: "http://mock-server.test",
      }))

      const res = await app.request("/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Write eval code" }],
        }),
      })

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error.type).toBe("rulebound_violation")
    })

    it("appends warning in advisory mode for violations", async () => {
      const { scanCodeBlockWithAST } = await import("../interceptor/ast-scanner.js")
      const mockScan = vi.mocked(scanCodeBlockWithAST)
      mockScan.mockResolvedValue([{
        ruleTitle: "No eval()",
        severity: "error",
        reason: "eval() detected",
        line: 1,
        codeSnippet: "eval('x')",
      }])

      const { detectLanguageFromAnnotation } = await import("../interceptor/ast-scanner.js")
      vi.mocked(detectLanguageFromAnnotation).mockReturnValue("javascript")

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("mock-server.test")) {
          return new Response(JSON.stringify({
            data: [{ id: "r1", title: "No Eval", content: "No eval", category: "security", severity: "error", modality: "must", tags: [] }],
          }), { status: 200 })
        }
        return new Response(JSON.stringify(openaiChatResponse("```javascript\neval('x')\n```")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      })
      vi.stubGlobal("fetch", mockFetch)

      const app = createProxy(makeConfig({
        scanResponses: true,
        enforcement: "advisory",
        ruleboundServerUrl: "http://mock-server.test",
      }))

      const res = await app.request("/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Write eval" }],
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      const content = body.choices[0].message.content
      expect(content).toContain("Rulebound")
    })
  })

  describe("streaming", () => {
    it("handles streaming responses", async () => {
      const sseChunks = [
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello" }, finish_reason: null }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: " world" }, finish_reason: null }] })}\n\n`,
        `data: [DONE]\n\n`,
      ]

      const mockStream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          for (const chunk of sseChunks) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("mock-server.test")) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 })
        }
        return new Response(mockStream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      })
      vi.stubGlobal("fetch", mockFetch)

      const app = createProxy(makeConfig({
        scanResponses: true,
        ruleboundServerUrl: "http://mock-server.test",
      }))

      const res = await app.request("/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hi" }],
          stream: true,
        }),
      })

      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toBe("text/event-stream")

      const text = await res.text()
      expect(text).toContain("Hello")
      expect(text).toContain("[DONE]")
    })
  })

  describe("error handling", () => {
    it("passes through upstream errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        })
      )
      vi.stubGlobal("fetch", mockFetch)

      const app = createProxy(makeConfig())
      const res = await app.request("/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hi" }],
        }),
      })

      expect(res.status).toBe(429)
    })
  })
})
