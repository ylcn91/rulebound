import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { logger } from "@rulebound/shared/logger"

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

describe("@rulebound/shared/logger redaction", () => {
  let capture: { stop: () => CapturedStreams } | undefined

  beforeEach(() => {
    capture = captureStreams()
  })

  afterEach(() => {
    capture?.stop()
  })

  it("redacts Authorization, Cookie, and api_key fields in info logs", () => {
    logger.info("Inbound request", {
      headers: {
        Authorization: "Bearer sk-live-must-not-leak-001",
        Cookie: "session=must-not-leak-002",
        "X-Other": "safe-value",
      },
      api_key: "must-not-leak-003",
      apiKey: "must-not-leak-004",
      access_token: "must-not-leak-005",
      refresh_token: "must-not-leak-006",
      secret_value: "must-not-leak-007",
      passcode: "safe-non-password",
      password: "must-not-leak-008",
      auth: "must-not-leak-009",
    })

    const { stdout } = capture!.stop()
    capture = undefined

    expect(stdout).toContain("Inbound request")
    expect(stdout).toContain("safe-value")
    // None of the sensitive markers should appear, in any of the field shapes.
    expect(stdout).not.toMatch(/must-not-leak-\d+/)
    expect(stdout).toContain("[REDACTED]")
  })

  it("redacts sensitive fields in error logs (stderr stream)", () => {
    logger.error("Auth failure", {
      token: "must-not-leak-err-001",
      Cookie: "session=must-not-leak-err-002",
      reason: "expired",
    })

    const { stderr } = capture!.stop()
    capture = undefined

    expect(stderr).toContain("Auth failure")
    expect(stderr).toContain("expired")
    expect(stderr).not.toContain("must-not-leak-err-001")
    expect(stderr).not.toContain("must-not-leak-err-002")
    expect(stderr).toContain("[REDACTED]")
  })

  it("redacts nested objects without dropping safe siblings", () => {
    logger.info("Nested context", {
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
})
