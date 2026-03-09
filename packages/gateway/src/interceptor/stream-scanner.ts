import type { Rule } from "@rulebound/engine"
import { shouldBlockForMode } from "./enforcement.js"
import {
  extractCodeBlocks,
  scanResponse,
  buildViolationWarning,
  type ScanResult,
} from "./post-response.js"

export interface StreamScannerConfig {
  rules: Rule[]
  enforcement: "advisory" | "moderate" | "strict"
  onViolation?: (warning: string) => void
}

export class StreamScanner {
  private buffer = ""
  private lastScannedBlockCount = 0
  private pendingRawChunks: Uint8Array[] = []
  private readonly rules: Rule[]
  private readonly enforcement: StreamScannerConfig["enforcement"]
  private readonly onViolation?: (warning: string) => void

  constructor(config: StreamScannerConfig) {
    this.rules = config.rules
    this.enforcement = config.enforcement
    this.onViolation = config.onViolation
  }

  appendChunk(chunk: string): void {
    this.buffer += chunk
  }

  appendRawChunk(chunk: Uint8Array): void {
    this.pendingRawChunks.push(chunk)
  }

  getBuffer(): string {
    return this.buffer
  }

  hasCompleteCodeBlock(): boolean {
    const openCount = (this.buffer.match(/```/g) || []).length
    return openCount >= 2 && openCount % 2 === 0
  }

  isInsideOpenCodeBlock(): boolean {
    const openCount = (this.buffer.match(/```/g) || []).length
    return openCount % 2 === 1
  }

  hasPendingRawChunks(): boolean {
    return this.pendingRawChunks.length > 0
  }

  consumePendingRawChunks(): Uint8Array[] {
    const chunks = this.pendingRawChunks
    this.pendingRawChunks = []
    return chunks
  }

  async scanAccumulated(): Promise<{
    action: "none" | "pass" | "warn" | "block"
    warning: string
    scanResult?: ScanResult
  }> {
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
    this.lastScannedBlockCount = 0
    this.pendingRawChunks = []
  }
}
