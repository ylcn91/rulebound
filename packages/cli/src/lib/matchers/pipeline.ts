import type { Matcher, MatcherContext, MatchResult, PipelineResult } from "./types.js"

interface MatcherResultSet {
  readonly matcherName: string
  readonly matcherIndex: number
  readonly results: readonly MatchResult[]
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

      const shouldReplace =
        result.confidence > existing.result.confidence ||
        (result.confidence === existing.result.confidence && matcherIndex > existing.matcherIndex)

      if (shouldReplace) {
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
