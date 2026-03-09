import type { MatchResult, MatchStatus, Matcher, MatcherContext, PipelineResult } from "./types.js"

interface MatcherResultSet {
  readonly matcherName: string
  readonly matcherIndex: number
  readonly results: readonly MatchResult[]
}

const STATUS_PRIORITY: Readonly<Record<MatchStatus, number>> = {
  VIOLATED: 3,
  PASS: 2,
  NOT_COVERED: 1,
}

function shouldReplaceResult(
  existing: { result: MatchResult; matcherIndex: number },
  next: MatchResult,
  matcherIndex: number,
): boolean {
  const nextPriority = STATUS_PRIORITY[next.status]
  const existingPriority = STATUS_PRIORITY[existing.result.status]

  if (nextPriority !== existingPriority) {
    return nextPriority > existingPriority
  }

  if (next.confidence !== existing.result.confidence) {
    return next.confidence > existing.result.confidence
  }

  return matcherIndex > existing.matcherIndex
}

function mergeResults(resultSets: readonly MatcherResultSet[]): readonly MatchResult[] {
  const grouped = new Map<string, { result: MatchResult; matcherIndex: number }>()

  for (const { matcherIndex, results } of resultSets) {
    for (const result of results) {
      const existing = grouped.get(result.ruleId)

      if (existing === undefined) {
        grouped.set(result.ruleId, { result, matcherIndex })
        continue
      }

      if (shouldReplaceResult(existing, result, matcherIndex)) {
        grouped.set(result.ruleId, { result, matcherIndex })
      }
    }
  }

  return [...grouped.values()].map((entry) => entry.result)
}

export class ValidationPipeline {
  private readonly matchers: readonly Matcher[]

  constructor(matchers: readonly Matcher[]) {
    this.matchers = matchers
  }

  async run(context: MatcherContext): Promise<PipelineResult> {
    const resultSets: MatcherResultSet[] = []

    for (let i = 0; i < this.matchers.length; i++) {
      const matcher = this.matchers[i]
      const results = await matcher.match(context)
      resultSets.push({
        matcherName: matcher.name,
        matcherIndex: i,
        results,
      })
    }

    const merged = mergeResults(resultSets)
    const layers = this.matchers.map((m) => m.name)

    return { results: merged, layers }
  }
}
