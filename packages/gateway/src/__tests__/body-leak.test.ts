import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
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

vi.mock("../interceptor/ast-scanner.js", () => ({
  scanCodeBlockWithAST: vi.fn().mockResolvedValue([]),
  detectLanguageFromAnnotation: vi.fn().mockReturnValue(null),
}))

const SECRET_PROMPT = "USER_SECRET_PROMPT_TOKEN_8c7d23ab"
const SECRET_RESPONSE = "MODEL_SECRET_RESPONSE_BODY_5f1e90cd"

function captureLogs(): { stop: () => string } {
  const chunks: string[] = []
  const originalStdout = process.stdout.write.bind(process.stdout)
  const originalStderr = process.stderr.write.bind(process.stderr)

  const capture = (chunk: Uint8Array | string): boolean => {
    chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8"))
    return true
  }

  process.stdout.write = capture as typeof process.stdout.write
  process.stderr.write = capture as typeof process.stderr.write

  return {
    stop() {
      process.stdout.write = originalStdout
      process.stderr.write = originalStderr
      return chunks.join("")
    },
  }
}

function makeConfig(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return {
    port: 0,
    targets: {
      openai: "http://mock-openai.test",
    },
    enforcement: "advisory",
    injectRules: false,
    scanResponses: false,
    auditLog: false,
    ...overrides,
  }
}

describe("gateway body-leak prevention (default DEBUG_FULL_BODIES off)", () => {
  beforeEach(() => {
    invalidateCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("does not emit user prompt or response body to stdout/stderr without DEBUG_FULL_BODIES", async () => {
    // This test guards against regressions where a future refactor logs raw
    // prompts or response payloads without gating them on DEBUG_FULL_BODIES.
    // The fixture markers SECRET_PROMPT / SECRET_RESPONSE are unique strings
    // that must never appear in logs in default operation.
    expect(process.env.DEBUG_FULL_BODIES).not.toBe("1")

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: SECRET_RESPONSE }, finish_reason: "stop" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", mockFetch)

    const app = createProxy(makeConfig({ scanResponses: true }))

    const capture = captureLogs()
    let logs: string
    try {
      const res = await app.request("/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: SECRET_PROMPT }],
        }),
      })
      expect(res.status).toBe(200)
    } finally {
      logs = capture.stop()
    }

    expect(logs).not.toContain(SECRET_PROMPT)
    expect(logs).not.toContain(SECRET_RESPONSE)
  })

  it("does not emit system prompt content when injecting rules", async () => {
    const SECRET_SYSTEM = "USER_SYSTEM_PROMPT_TOKEN_a1b2c3d4"

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("mock-server.test")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "r1",
                title: "No Secrets",
                content: "No hardcoded secrets",
                category: "security",
                severity: "error",
                modality: "must",
                tags: [],
              },
            ],
          }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    })
    vi.stubGlobal("fetch", mockFetch)

    const app = createProxy(
      makeConfig({
        injectRules: true,
        ruleboundServerUrl: "http://mock-server.test",
      }),
    )

    const capture = captureLogs()
    let logs: string
    try {
      const res = await app.request("/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SECRET_SYSTEM },
            { role: "user", content: "hi" },
          ],
        }),
      })
      expect(res.status).toBe(200)
    } finally {
      logs = capture.stop()
    }

    expect(logs).not.toContain(SECRET_SYSTEM)
  })
})
