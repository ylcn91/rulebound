export type EnforcementMode = "advisory" | "moderate" | "strict"

export interface EnforcementConfig {
  readonly mode: EnforcementMode
  readonly scoreThreshold: number
  readonly autoPromote: boolean
}

export const DEFAULT_ENFORCEMENT: EnforcementConfig = {
  mode: "advisory",
  scoreThreshold: 70,
  autoPromote: true,
}

interface BlockCheckInput {
  readonly hasMustViolation: boolean
  readonly score: number
}

export function shouldBlock(config: EnforcementConfig, input: BlockCheckInput): boolean {
  switch (config.mode) {
    case "advisory":
      return false
    case "moderate":
      return input.hasMustViolation || input.score < config.scoreThreshold
    case "strict":
      return input.hasMustViolation || input.score < config.scoreThreshold
  }
}

export function shouldWarn(config: EnforcementConfig, hasShouldViolation: boolean): boolean {
  return config.mode === "strict" && hasShouldViolation
}

export function shouldSuggestPromotion(config: EnforcementConfig, score: number): boolean {
  return config.autoPromote && config.mode !== "strict" && score >= 90
}
