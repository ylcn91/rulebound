import { describe, it, expect, vi, afterEach } from "vitest"
import { StreamScanner, __testing } from "../interceptor/stream-scanner.js"
import { extractContentFromSSE } from "../provider-adapter.js"

vi.mock("../interceptor/post-response.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../interceptor/post-response.js")>()
  return {
    ...original,
    scanResponse: vi.fn().mockResolvedValue({
      codeBlockCount: 0,
      hasViolations: false,
      violations: [],
      enforcement: {
        hasMustViolation: false,
        hasShouldViolation: false,
        score: 100,
        semanticScore: 100,
        astErrorCount: 0,
        astWarningCount: 0,
        hasAdvisoryMustViolation: false,
        hasAdvisoryShouldViolation: false,
      },
    }),
  }
})

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

describe("StreamScanner — buffer bounds", () => {
  const originalMaxEnv = process.env.GATEWAY_STREAM_MAX_BUFFER

  afterEach(() => {
    if (originalMaxEnv === undefined) {
      delete process.env.GATEWAY_STREAM_MAX_BUFFER
    } else {
      process.env.GATEWAY_STREAM_MAX_BUFFER = originalMaxEnv
    }
    vi.restoreAllMocks()
  })

  it("exposes the 256 KiB default cap", () => {
    expect(__testing.DEFAULT_MAX_BUFFERED_BYTES).toBe(262_144)
  })

  it("resolveMaxBufferedBytes honours the explicit option first", () => {
    expect(__testing.resolveMaxBufferedBytes({ maxBufferedBytes: 4096 })).toBe(4096)
  })

  it("resolveMaxBufferedBytes reads GATEWAY_STREAM_MAX_BUFFER from env", () => {
    expect(
      __testing.resolveMaxBufferedBytes(
        {},
        { GATEWAY_STREAM_MAX_BUFFER: "8192" },
      ),
    ).toBe(8192)
  })

  it("resolveMaxBufferedBytes falls back to default on invalid env", () => {
    expect(
      __testing.resolveMaxBufferedBytes(
        {},
        { GATEWAY_STREAM_MAX_BUFFER: "garbage" },
      ),
    ).toBe(262_144)
    expect(
      __testing.resolveMaxBufferedBytes(
        {},
        { GATEWAY_STREAM_MAX_BUFFER: "0" },
      ),
    ).toBe(262_144)
    expect(
      __testing.resolveMaxBufferedBytes(
        {},
        { GATEWAY_STREAM_MAX_BUFFER: "-100" },
      ),
    ).toBe(262_144)
  })

  it("flips to overflow when chunked text exceeds the cap, emits one warn line", () => {
    const scanner = new StreamScanner({
      rules: [],
      enforcement: "advisory",
      maxBufferedBytes: 64,
    })

    const capture = captureLogs()
    let logs: string
    try {
      scanner.appendChunk("a".repeat(50))
      expect(scanner.isOverflowed()).toBe(false)
      scanner.appendChunk("b".repeat(50))
      expect(scanner.isOverflowed()).toBe(true)
    } finally {
      logs = capture.stop()
    }

    expect(logs).toContain("gateway_stream_buffer_overflow")
    const matches = logs.match(/gateway_stream_buffer_overflow/g) ?? []
    expect(matches.length).toBe(1)
  })

  it("buffer is cleared after overflow but pending raw chunks remain consumable", () => {
    const scanner = new StreamScanner({
      rules: [],
      enforcement: "advisory",
      maxBufferedBytes: 32,
    })

    const raw1 = new Uint8Array(20)
    scanner.appendRawChunk(raw1)
    scanner.appendChunk("x".repeat(40))
    expect(scanner.isOverflowed()).toBe(true)

    // Raw chunk pipeline is preserved so callers can flush downstream.
    expect(scanner.hasPendingRawChunks()).toBe(true)
    const remaining = scanner.consumePendingRawChunks()
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toBe(raw1)

    // Buffer is empty; further appends are dropped silently.
    expect(scanner.getBuffer()).toBe("")
    scanner.appendChunk("more")
    expect(scanner.getBuffer()).toBe("")
  })

  it("scanAccumulated short-circuits once overflowed", async () => {
    const scanner = new StreamScanner({
      rules: [],
      enforcement: "advisory",
      maxBufferedBytes: 16,
    })
    scanner.appendChunk("```js\nlong content far beyond the cap\n```")
    expect(scanner.isOverflowed()).toBe(true)
    const result = await scanner.scanAccumulated()
    expect(result.action).toBe("none")
  })

  it("reset clears overflow state and resumes scanning", () => {
    const scanner = new StreamScanner({
      rules: [],
      enforcement: "advisory",
      maxBufferedBytes: 16,
    })
    scanner.appendChunk("y".repeat(100))
    expect(scanner.isOverflowed()).toBe(true)
    scanner.reset()
    expect(scanner.isOverflowed()).toBe(false)
    scanner.appendChunk("ok")
    expect(scanner.getBuffer()).toBe("ok")
  })
})

describe("StreamScanner — malformed input", () => {
  it("tolerates malformed SSE chunks (extractContentFromSSE returns empty)", () => {
    const broken = "not an sse frame at all\n\nstill not\n"
    const extracted = extractContentFromSSE("openai", broken)
    // Malformed SSE yields no content; the scanner buffer stays empty.
    const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
    scanner.appendChunk(extracted)
    expect(scanner.getBuffer()).toBe("")
  })

  it("handles a UTF-8 multi-byte sequence split across chunks via TextDecoder", () => {
    // The euro sign ('€') is 0xE2 0x82 0xAC in UTF-8. Split between chunk 1
    // (first two bytes) and chunk 2 (last byte). TextDecoder with stream:true
    // is the standard primitive callers use; the scanner sees the assembled
    // codepoint exactly once.
    const decoder = new TextDecoder()
    const part1 = new Uint8Array([0xe2, 0x82])
    const part2 = new Uint8Array([0xac])

    const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
    scanner.appendChunk(decoder.decode(part1, { stream: true }))
    scanner.appendChunk(decoder.decode(part2, { stream: true }))
    expect(scanner.getBuffer()).toBe("€")
  })

  it("ignores empty chunks without flipping into overflow on a tight cap", () => {
    const scanner = new StreamScanner({
      rules: [],
      enforcement: "advisory",
      maxBufferedBytes: 4,
    })
    for (let i = 0; i < 20; i++) {
      scanner.appendChunk("")
    }
    expect(scanner.isOverflowed()).toBe(false)
    expect(scanner.getBuffer()).toBe("")
  })
})

describe("StreamScanner — provider-disconnect resilience", () => {
  it("survives a mid-block disconnect without throwing during reset", () => {
    const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
    scanner.appendChunk("Here is partial code:\n```python\nprint(")
    expect(scanner.isInsideOpenCodeBlock()).toBe(true)
    // Simulate provider disconnect: caller resets to discard the half-open
    // block. No exception, scanner ready for next request.
    expect(() => scanner.reset()).not.toThrow()
    expect(scanner.getBuffer()).toBe("")
  })
})

describe("StreamScanner — scan timeout via AbortSignal.timeout", () => {
  it("AbortSignal.timeout aborts within the configured window", async () => {
    // We do not wire AbortSignal into scanAccumulated itself yet — it is a
    // primitive available to callers wrapping the scan. This test pins the
    // shape so future work can rely on the contract: a 50 ms timeout aborts
    // on its own without the scanner needing knowledge of it.
    const signal = AbortSignal.timeout(50)
    expect(signal.aborted).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(signal.aborted).toBe(true)
    // The reason carries a TimeoutError so callers can distinguish from a
    // manual abort.
    expect((signal.reason as Error)?.name).toBe("TimeoutError")
  })
})
