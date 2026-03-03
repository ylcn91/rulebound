import type { Rule } from "@rulebound/engine"
import { extractCodeBlocks, scanResponse, buildViolationWarning } from "./post-response.js"

export interface StreamScannerConfig {
  rules: Rule[]
  enforcement: "advisory" | "moderate" | "strict"
  onViolation?: (warning: string) => void
}

export class StreamScanner {
  private buffer = ""
  private readonly rules: Rule[]
  private readonly enforcement: string
  private readonly onViolation?: (warning: string) => void

  constructor(config: StreamScannerConfig) {
    this.rules = config.rules
    this.enforcement = config.enforcement
    this.onViolation = config.onViolation
  }

  appendChunk(chunk: string): void {
    this.buffer += chunk
  }

  getBuffer(): string {
    return this.buffer
  }

  hasCompleteCodeBlock(): boolean {
    const openCount = (this.buffer.match(/```/g) || []).length
    return openCount >= 2 && openCount % 2 === 0
  }

  async scanAccumulated(): Promise<{
    hasViolations: boolean
    warning: string
  }> {
    if (this.rules.length === 0) return { hasViolations: false, warning: "" }

    const codeBlocks = extractCodeBlocks(this.buffer)
    if (codeBlocks.length === 0) return { hasViolations: false, warning: "" }

    const result = await scanResponse(this.buffer, this.rules)

    if (result.hasViolations) {
      const warning = buildViolationWarning(result.violations)
      this.onViolation?.(warning)
      return { hasViolations: true, warning }
    }

    return { hasViolations: false, warning: "" }
  }

  reset(): void {
    this.buffer = ""
  }
}
