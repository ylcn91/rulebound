import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { createServer, type Server } from "node:http"
import { AddressInfo } from "node:net"
import { createProxy } from "../proxy.js"
import { invalidateCache } from "../rule-cache.js"
import type { GatewayConfig } from "../config.js"

vi.mock("@rulebound/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rulebound/engine")>()
  return {
    ...actual,
    recordValidationEvent: vi.fn(),
  }
})

// Force AST scanner to flag the response so we exercise the
// advisory-non-blocking contract end-to-end against a real HTTP upstream.
vi.mock("../interceptor/ast-scanner.js", () => ({
  scanCodeBlockWithAST: vi.fn().mockResolvedValue([
    {
      ruleId: "ts-no-eval",
      ruleTitle: "No eval()",
      severity: "error",
      reason: "AST pattern: eval() detected",
      line: 1,
      codeSnippet: "eval('x')",
    },
  ]),
  detectLanguageFromAnnotation: vi.fn().mockReturnValue("javascript"),
}))

interface UpstreamHarness {
  readonly server: Server
  readonly baseUrl: string
  readonly receivedRequests: Array<{ method: string; path: string; body: string }>
  close(): Promise<void>
}

async function startFakeUpstream(responseBody: string): Promise<UpstreamHarness> {
  const receivedRequests: Array<{ method: string; path: string; body: string }> = []

  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => {
      receivedRequests.push({
        method: req.method ?? "",
        path: req.url ?? "",
        body: Buffer.concat(chunks).toString("utf-8"),
      })
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(responseBody)
    })
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`

  return {
    server,
    baseUrl,
    receivedRequests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      }),
  }
}

function makeConfig(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return {
    port: 0,
    targets: {},
    enforcement: "advisory",
    injectRules: false,
    scanResponses: false,
    auditLog: false,
    ...overrides,
  }
}

describe("gateway against fake in-process HTTP upstream", () => {
  let upstream: UpstreamHarness | undefined

  beforeEach(() => {
    invalidateCache()
  })

  afterEach(async () => {
    if (upstream) {
      await upstream.close()
      upstream = undefined
    }
  })

  it("forwards the proxied response unchanged and never blocks on advisory findings", async () => {
    const upstreamBody = JSON.stringify({
      id: "chatcmpl-deterministic",
      object: "chat.completion",
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "```javascript\neval('x')\n```" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })

    upstream = await startFakeUpstream(upstreamBody)

    const app = createProxy(
      makeConfig({
        targets: { openai: upstream.baseUrl },
        scanResponses: true,
        enforcement: "advisory",
      }),
    )

    const res = await app.request("/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Write eval code" }],
      }),
    })

    // (b) advisory findings must not block.
    expect(res.status).toBe(200)

    const body = await res.json()

    // (a) every field from the upstream body is preserved. The proxy may
    // append a warning to assistant content in advisory mode, so we assert
    // the prefix matches and structural fields are untouched.
    expect(body.id).toBe("chatcmpl-deterministic")
    expect(body.object).toBe("chat.completion")
    expect(body.model).toBe("gpt-4o-mini")
    expect(body.usage).toEqual({ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 })
    expect(body.choices[0].message.role).toBe("assistant")
    expect(body.choices[0].message.content.startsWith("```javascript\neval('x')\n```")).toBe(true)
    expect(body.choices[0].finish_reason).toBe("stop")

    // Upstream actually received the request via a real socket round-trip.
    expect(upstream.receivedRequests).toHaveLength(1)
    expect(upstream.receivedRequests[0].method).toBe("POST")
    expect(upstream.receivedRequests[0].path).toBe("/v1/chat/completions")
    const upstreamSeenBody = JSON.parse(upstream.receivedRequests[0].body)
    expect(upstreamSeenBody.model).toBe("gpt-4o-mini")
  })

  it("returns the upstream body byte-equal for non-chat passthrough endpoints", async () => {
    const upstreamBody = JSON.stringify({ data: [{ id: "model-a" }, { id: "model-b" }] })
    upstream = await startFakeUpstream(upstreamBody)

    const app = createProxy(
      makeConfig({
        targets: { openai: upstream.baseUrl },
      }),
    )

    const res = await app.request("/openai/v1/models", { method: "GET" })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe(upstreamBody)
  })
})
