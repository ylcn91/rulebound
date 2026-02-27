import type { LocalRule } from "../local-rules.js"
import type { Matcher, MatcherContext, MatchResult } from "./types.js"

const SIMILARITY_THRESHOLD = 0.15

function tokenize(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3)
}

function termFrequency(
  tokens: readonly string[]
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  const max = Math.max(...counts.values(), 1)
  const tf = new Map<string, number>()
  for (const [term, count] of counts) {
    tf.set(term, count / max)
  }
  return tf
}

function inverseDocumentFrequency(
  docs: readonly (readonly string[])[]
): ReadonlyMap<string, number> {
  const n = docs.length
  const docCount = new Map<string, number>()

  for (const doc of docs) {
    const unique = new Set(doc)
    for (const term of unique) {
      docCount.set(term, (docCount.get(term) ?? 0) + 1)
    }
  }

  const idf = new Map<string, number>()
  for (const [term, count] of docCount) {
    idf.set(term, Math.log((n + 1) / (count + 1)) + 1)
  }
  return idf
}

function tfidfVector(
  tf: ReadonlyMap<string, number>,
  idf: ReadonlyMap<string, number>
): ReadonlyMap<string, number> {
  const vector = new Map<string, number>()
  for (const [term, tfVal] of tf) {
    const idfVal = idf.get(term) ?? 0
    vector.set(term, tfVal * idfVal)
  }
  return vector
}

function cosineSimilarity(
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>
): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (const [term, val] of a) {
    normA += val * val
    const bVal = b.get(term)
    if (bVal !== undefined) {
      dot += val * bVal
    }
  }

  for (const [, val] of b) {
    normB += val * val
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0
  return dot / denominator
}

function ruleToText(rule: LocalRule): string {
  return [rule.title, rule.content, rule.tags.join(" "), rule.category]
    .filter(Boolean)
    .join(" ")
}

export class SemanticMatcher implements Matcher {
  readonly name = "semantic"

  async match(context: MatcherContext): Promise<readonly MatchResult[]> {
    const { plan, rules } = context

    const planTokens = tokenize(plan)
    const ruleTexts = rules.map((rule) => ({
      rule,
      tokens: tokenize(ruleToText(rule)),
    }))

    const allDocs: readonly (readonly string[])[] = [
      planTokens,
      ...ruleTexts.map((r) => r.tokens),
    ]
    const idf = inverseDocumentFrequency(allDocs)

    const planTf = termFrequency(planTokens)
    const planVector = tfidfVector(planTf, idf)

    const results: MatchResult[] = []

    for (const { rule, tokens } of ruleTexts) {
      const ruleTf = termFrequency(tokens)
      const ruleVector = tfidfVector(ruleTf, idf)
      const similarity = cosineSimilarity(planVector, ruleVector)

      if (similarity >= SIMILARITY_THRESHOLD) {
        results.push({
          ruleId: rule.id,
          status: "PASS",
          confidence: Math.min(0.5 + similarity, 0.85),
          reason: `Semantic similarity ${similarity.toFixed(3)} exceeds threshold`,
        })
      } else {
        results.push({
          ruleId: rule.id,
          status: "NOT_COVERED",
          confidence: 0.4,
          reason: `Semantic similarity ${similarity.toFixed(3)} below threshold`,
        })
      }
    }

    return results
  }
}
