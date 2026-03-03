import type { EnforcementConfig, EnforcementMode, BlockCheckInput } from "./types.js"

export const DEFAULT_ENFORCEMENT: EnforcementConfig = {
  mode: "advisory",
  scoreThreshold: 70,
  autoPromote: true,
}

export function shouldBlock(config: EnforcementConfig, input: BlockCheckInput): boolean {
  switch (config.mode) {
    case "advisory":
      return false
    case "moderate":
      return input.hasMustViolation || input.score < config.scoreThreshold
    case "strict":
      return input.hasMustViolation || (input.hasShouldViolation ?? false) || input.score < config.scoreThreshold
  }
}

export function shouldWarn(config: EnforcementConfig, hasShouldViolation: boolean): boolean {
  return config.mode === "strict" && hasShouldViolation
}

export function shouldSuggestPromotion(config: EnforcementConfig, score: number): boolean {
  return config.autoPromote && config.mode !== "strict" && score >= 90
}

export function calculateScore(results: readonly { status: string }[]): number {
  const total = results.length
  if (total === 0) return 100

  let weighted = 0
  for (const r of results) {
    if (r.status === "PASS") weighted += 1
    else if (r.status === "NOT_COVERED") weighted += 0.5
  }

  return Math.round((weighted / total) * 100)
}

const VALID_MODES: readonly EnforcementMode[] = ["advisory", "moderate", "strict"]

export function isValidMode(value: string): value is EnforcementMode {
  return VALID_MODES.includes(value as EnforcementMode)
}
