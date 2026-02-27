import type { LocalRule } from "../local-rules.js"

export type MatchStatus = "PASS" | "VIOLATED" | "NOT_COVERED"

export interface MatchResult {
  readonly ruleId: string
  readonly status: MatchStatus
  readonly confidence: number
  readonly reason: string
  readonly suggestedFix?: string
}

export interface MatcherContext {
  readonly plan: string
  readonly rules: readonly LocalRule[]
  readonly task?: string
}

export interface Matcher {
  readonly name: string
  match(context: MatcherContext): Promise<readonly MatchResult[]>
}

export interface PipelineResult {
  readonly results: readonly MatchResult[]
  readonly layers: readonly string[]
}
