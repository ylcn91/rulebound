import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createProxy } from "../proxy.js"
import type { GatewayConfig } from "../config.js"

function makeConfig(overrides: Partial<GatewayConfig> = {}): GatewayConfig {
  return {
    port: 0,
    targets: { openai: "http://mock-openai.test" },
    enforcement: "advisory",
    injectRules: false,
    scanResponses: false,
    auditLog: false,
    ...overrides,
  }
}

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

describe("gateway privacy startup warning", () => {
  const originalEnv = process.env.DEBUG_FULL_BODIES

  beforeEach(() => {
    delete process.env.DEBUG_FULL_BODIES
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DEBUG_FULL_BODIES
    } else {
      process.env.DEBUG_FULL_BODIES = originalEnv
    }
  })

  it("emits a single warn line when DEBUG_FULL_BODIES=1", () => {
    process.env.DEBUG_FULL_BODIES = "1"
    const capture = captureLogs()
    let logs: string
    try {
      createProxy(makeConfig())
    } finally {
      logs = capture.stop()
    }
    expect(logs).toContain("DEBUG_FULL_BODIES enabled")
    expect(logs).toContain("Disable in production")
    // Exactly one match — the warn is one-shot per createProxy().
    const matches = logs.match(/DEBUG_FULL_BODIES enabled/g) ?? []
    expect(matches.length).toBe(1)
  })

  it("emits no warn line when DEBUG_FULL_BODIES is unset", () => {
    const capture = captureLogs()
    let logs: string
    try {
      createProxy(makeConfig())
    } finally {
      logs = capture.stop()
    }
    expect(logs).not.toContain("DEBUG_FULL_BODIES enabled")
  })

  it("emits no warn line when DEBUG_FULL_BODIES is set to something other than '1'", () => {
    process.env.DEBUG_FULL_BODIES = "true"
    const capture = captureLogs()
    let logs: string
    try {
      createProxy(makeConfig())
    } finally {
      logs = capture.stop()
    }
    expect(logs).not.toContain("DEBUG_FULL_BODIES enabled")
  })
})
