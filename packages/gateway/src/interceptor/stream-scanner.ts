import type { Rule } from "@rulebound/engine"
import { logger } from "../logger.js"
import { shouldBlockForMode } from "./enforcement.js"
import {
  extractCodeBlocks,
  scanResponse,
  buildViolationWarning,
  type ScanResult,
} from "./post-response.js"

const DEFAULT_MAX_BUFFERED_BYTES = 262_144 // 256 KiB

export interface StreamScannerConfig {
  rules: Rule[]
  enforcement: "advisory" | "moderate" | "strict"
  onViolation?: (warning: string) => void
  /**
   * Maximum number of UTF-8 bytes the scanner keeps in its accumulator and
   * the pending-raw-chunks queue. When exceeded, the scanner enters an
   * "overflow" state: pending raw chunks are flushed unscanned, the buffer
   * is dropped, and further calls become passthrough. Default 256 KiB.
   *
   * Operators override the default via the env `GATEWAY_STREAM_MAX_BUFFER`
   * (a positive integer of bytes).
   */
  maxBufferedBytes?: number
}

function resolveMaxBufferedBytes(
  config: Pick<StreamScannerConfig, "maxBufferedBytes">,
  env: NodeJS.ProcessEnv = process.env,
): number {
  if (typeof config.maxBufferedBytes === "number" && config.maxBufferedBytes > 0) {
    return config.maxBufferedBytes
  }
  const raw = env.GATEWAY_STREAM_MAX_BUFFER
  if (raw !== undefined && raw.trim() !== "") {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_MAX_BUFFERED_BYTES
}

function byteLength(s: string): number {
  return Buffer.byteLength(s, "utf-8")
}

export class StreamScanner {
  private buffer = ""
  private bufferBytes = 0
  private lastScannedBlockCount = 0
  private pendingRawChunks: Uint8Array[] = []
  private pendingRawBytes = 0
  private overflowed = false
  private readonly rules: Rule[]
  private readonly enforcement: StreamScannerConfig["enforcement"]
  private readonly onViolation?: (warning: string) => void
  private readonly maxBufferedBytes: number

  constructor(config: StreamScannerConfig) {
    this.rules = config.rules
    this.enforcement = config.enforcement
    this.onViolation = config.onViolation
    this.maxBufferedBytes = resolveMaxBufferedBytes(config)
  }

  isOverflowed(): boolean {
    return this.overflowed
  }

  appendChunk(chunk: string): void {
    if (this.overflowed) return
    this.buffer += chunk
    this.bufferBytes += byteLength(chunk)
    this.enforceBudget()
  }

  appendRawChunk(chunk: Uint8Array): void {
    if (this.overflowed) return
    this.pendingRawChunks.push(chunk)
    this.pendingRawBytes += chunk.byteLength
    this.enforceBudget()
  }

  getBuffer(): string {
    return this.buffer
  }

  hasCompleteCodeBlock(): boolean {
    if (this.overflowed) return false
    const openCount = (this.buffer.match(/```/g) || []).length
    return openCount >= 2 && openCount % 2 === 0
  }

  isInsideOpenCodeBlock(): boolean {
    if (this.overflowed) return false
    const openCount = (this.buffer.match(/```/g) || []).length
    return openCount % 2 === 1
  }

  hasPendingRawChunks(): boolean {
    return this.pendingRawChunks.length > 0
  }

  consumePendingRawChunks(): Uint8Array[] {
    const chunks = this.pendingRawChunks
    this.pendingRawChunks = []
    this.pendingRawBytes = 0
    return chunks
  }

  async scanAccumulated(): Promise<{
    action: "none" | "pass" | "warn" | "block"
    warning: string
    scanResult?: ScanResult
  }> {
    if (this.overflowed) {
      return { action: "none", warning: "" }
    }

    const codeBlocks = extractCodeBlocks(this.buffer)
    if (codeBlocks.length === 0 || codeBlocks.length <= this.lastScannedBlockCount) {
      return { action: "none", warning: "" }
    }

    this.lastScannedBlockCount = codeBlocks.length

    const scanResult = await scanResponse(this.buffer, this.rules)

    if (scanResult.hasViolations) {
      const warning = buildViolationWarning(scanResult.violations)
      this.onViolation?.(warning)
      const action = this.enforcement === "advisory" || !shouldBlockForMode(this.enforcement, scanResult.enforcement)
        ? "warn"
        : "block"
      return { action, warning, scanResult }
    }

    return { action: "pass", warning: "", scanResult }
  }

  reset(): void {
    this.buffer = ""
    this.bufferBytes = 0
    this.lastScannedBlockCount = 0
    this.pendingRawChunks = []
    this.pendingRawBytes = 0
    this.overflowed = false
  }

  private enforceBudget(): void {
    if (this.overflowed) return
    if (this.bufferBytes + this.pendingRawBytes <= this.maxBufferedBytes) return

    // Overflow path: we deliberately drop accumulated buffer (we cannot scan
    // it any longer without exceeding memory bounds) and leave pendingRaw
    // intact so the caller can flush remaining raw chunks to the client.
    // The single log line gives operators a signal to investigate (e.g.
    // upstream sending an unbounded text response).
    logger.warn("gateway_stream_buffer_overflow", {
      bufferBytes: this.bufferBytes,
      pendingRawBytes: this.pendingRawBytes,
      cap: this.maxBufferedBytes,
    })
    this.buffer = ""
    this.bufferBytes = 0
    this.overflowed = true
  }
}

// Test-only exports for the bounds suite.
export const __testing = {
  DEFAULT_MAX_BUFFERED_BYTES,
  resolveMaxBufferedBytes,
}
