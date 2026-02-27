import { describe, it, expect } from "vitest"
import { shouldBlock, type EnforcementConfig } from "./enforcement.js"

describe("shouldBlock", () => {
  it("advisory mode never blocks", () => {
    const config: EnforcementConfig = { mode: "advisory", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: true, score: 0 })).toBe(false)
  })

  it("moderate mode blocks on MUST violation", () => {
    const config: EnforcementConfig = { mode: "moderate", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: true, score: 80 })).toBe(true)
  })

  it("moderate mode blocks when score below threshold", () => {
    const config: EnforcementConfig = { mode: "moderate", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: false, score: 50 })).toBe(true)
  })

  it("moderate mode passes when no violation and score above threshold", () => {
    const config: EnforcementConfig = { mode: "moderate", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: false, score: 85 })).toBe(false)
  })

  it("strict mode blocks on any MUST violation", () => {
    const config: EnforcementConfig = { mode: "strict", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: true, score: 100 })).toBe(true)
  })

  it("strict mode blocks when score below threshold", () => {
    const config: EnforcementConfig = { mode: "strict", scoreThreshold: 70, autoPromote: false }
    expect(shouldBlock(config, { hasMustViolation: false, score: 60 })).toBe(true)
  })
})
