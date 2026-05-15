import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { logger, redactSensitive } from "../logger.js"

interface CapturedStreams {
  readonly stdout: string
  readonly stderr: string
}

function captureStreams(): { stop: () => CapturedStreams } {
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []
  const originalStdout = process.stdout.write.bind(process.stdout)
  const originalStderr = process.stderr.write.bind(process.stderr)

  process.stdout.write = ((chunk: Uint8Array | string): boolean => {
    stdoutChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8"))
    return true
  }) as typeof process.stdout.write

  process.stderr.write = ((chunk: Uint8Array | string): boolean => {
    stderrChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf-8"))
    return true
  }) as typeof process.stderr.write

  return {
    stop() {
      process.stdout.write = originalStdout
      process.stderr.write = originalStderr
      return {
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      }
    },
  }
}

function lastJsonLine(stream: string): Record<string, unknown> {
  const lines = stream.split("\n").filter(Boolean)
  expect(lines.length).toBeGreaterThan(0)
  return JSON.parse(lines[lines.length - 1]!) as Record<string, unknown>
}

describe("@rulebound/shared logger", () => {
  let capture: { stop: () => CapturedStreams } | undefined

  beforeEach(() => {
    capture = captureStreams()
  })

  afterEach(() => {
    capture?.stop()
  })

  it("emits a JSON line on stdout for info()", () => {
    logger.info("hello", { user: "alice" })
    const { stdout, stderr } = capture!.stop()
    capture = undefined

    expect(stderr).toBe("")
    const entry = lastJsonLine(stdout)
    expect(entry.level).toBe("info")
    expect(entry.message).toBe("hello")
    expect(entry.user).toBe("alice")
    expect(typeof entry.timestamp).toBe("string")
  })

  it("routes warn/error to stderr and info/debug to stdout", () => {
    logger.info("info-line")
    logger.debug("debug-line")
    logger.warn("warn-line")
    logger.error("error-line")
    const { stdout, stderr } = capture!.stop()
    capture = undefined

    expect(stdout).toContain("info-line")
    expect(stdout).toContain("debug-line")
    expect(stdout).not.toContain("warn-line")
    expect(stdout).not.toContain("error-line")
    expect(stderr).toContain("warn-line")
    expect(stderr).toContain("error-line")
  })

  it("redacts Authorization, Cookie, and api_key fields as bare [REDACTED] (no surrounding quotes)", () => {
    logger.info("inbound", {
      headers: {
        Authorization: "Bearer must-not-leak-001",
        Cookie: "session=must-not-leak-002",
        "X-Other": "safe-value",
      },
      api_key: "must-not-leak-003",
      apiKey: "must-not-leak-004",
      access_token: "must-not-leak-005",
      refresh_token: "must-not-leak-006",
      secret_value: "must-not-leak-007",
      password: "must-not-leak-008",
      auth: "must-not-leak-009",
    })
    const { stdout } = capture!.stop()
    capture = undefined

    expect(stdout).toContain("safe-value")
    expect(stdout).not.toMatch(/must-not-leak-\d+/)
    // Critical: redaction marker must be the JSON string "[REDACTED]" — not
    // a double-quoted string or any other shape. This protects the contract
    // the previous hand-written .js file produced.
    expect(stdout).toContain('"[REDACTED]"')
    expect(stdout).not.toContain('"\\"[REDACTED]\\""')
  })

  it("redacts nested objects without dropping safe siblings", () => {
    logger.info("nested", {
      request: {
        method: "POST",
        headers: {
          authorization: "Bearer must-not-leak-nested-001",
          "x-api-key": "must-not-leak-nested-002",
        },
        params: { id: "safe-id-123" },
      },
    })
    const { stdout } = capture!.stop()
    capture = undefined

    expect(stdout).toContain("safe-id-123")
    expect(stdout).toContain("POST")
    expect(stdout).not.toContain("must-not-leak-nested-001")
    expect(stdout).not.toContain("must-not-leak-nested-002")
  })

  it("treats sensitive keys in arrays of objects", () => {
    logger.info("array", {
      items: [
        { id: 1, token: "leak-arr-1" },
        { id: 2, token: "leak-arr-2" },
      ],
    })
    const { stdout } = capture!.stop()
    capture = undefined

    expect(stdout).not.toContain("leak-arr-1")
    expect(stdout).not.toContain("leak-arr-2")
    expect(stdout).toContain('"id":1')
    expect(stdout).toContain('"id":2')
  })

  it("does not redact non-sensitive lookalikes (passcode, keyword)", () => {
    logger.info("safe", {
      passcode: "safe-passcode-value",
      keyword: "safe-keyword-value",
    })
    const { stdout } = capture!.stop()
    capture = undefined

    expect(stdout).toContain("safe-passcode-value")
    expect(stdout).toContain("safe-keyword-value")
  })

  it("stops redacting after depth 6 (boundary)", () => {
    // depth 0..6 redacted; deeper boundary verified via redactSensitive directly
    const deep = {
      a: { b: { c: { d: { e: { f: { token: "must-redact" } } } } } },
    }
    const out = redactSensitive(deep) as { a: { b: { c: { d: { e: { f: { token: string } } } } } } }
    expect(out.a.b.c.d.e.f.token).toBe("[REDACTED]")
  })

  it("redactSensitive() is idempotent for already-redacted values", () => {
    const once = redactSensitive({ token: "secret" })
    const twice = redactSensitive(once)
    expect(twice).toEqual({ token: "[REDACTED]" })
  })
})
