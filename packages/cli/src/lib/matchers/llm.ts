import type { LocalRule } from "../local-rules.js"
import type { Matcher, MatcherContext, MatchResult, MatchStatus } from "./types.js"

export interface LLMConfig {
  readonly provider: "anthropic" | "openai"
  readonly model?: string
}

interface LLMValidationResult {
  readonly status: MatchStatus
  readonly confidence: number
  readonly reason: string
}

const CONCURRENCY_LIMIT = 5

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
}

function buildPrompt(plan: string, rule: LocalRule): {
  readonly system: string
  readonly prompt: string
} {
  const system = [
    "You are a coding rule compliance evaluator.",
    "Given a coding plan and a rule, determine if the plan complies with the rule.",
    "Evaluate carefully and return a structured assessment.",
    "",
    "Status definitions:",
    "- PASS: The plan explicitly addresses and complies with the rule.",
    "- VIOLATED: The plan contradicts or violates the rule.",
    "- NOT_COVERED: The plan does not mention anything related to the rule.",
    "",
    "Confidence should reflect how certain you are about the assessment (0.0 to 1.0).",
    "Reason should be a concise explanation of your assessment.",
  ].join("\n")

  const ruleDescription = [
    `Rule: ${rule.title}`,
    `Category: ${rule.category}`,
    `Severity: ${rule.severity}`,
    `Modality: ${rule.modality}`,
    rule.tags.length > 0 ? `Tags: ${rule.tags.join(", ")}` : null,
    "",
    "Rule Content:",
    rule.content,
  ]
    .filter((line) => line !== null)
    .join("\n")

  const prompt = [
    ruleDescription,
    "",
    "---",
    "",
    "Plan to evaluate:",
    plan,
  ].join("\n")

  return { system, prompt }
}

async function getModel(
  config: LLMConfig
): Promise<ReturnType<typeof createModelFromProvider>> {
  const provider = config.provider
  const modelName = config.model ?? DEFAULT_MODELS[provider]

  if (provider === "anthropic") {
    try {
      const { anthropic } = await import("@ai-sdk/anthropic")
      return anthropic(modelName)
    } catch {
      throw new Error(
        "--llm requires AI packages. Run: pnpm add ai @ai-sdk/anthropic"
      )
    }
  }

  if (provider === "openai") {
    try {
      const { openai } = await import("@ai-sdk/openai")
      return openai(modelName)
    } catch {
      throw new Error(
        "--llm requires AI packages. Run: pnpm add ai @ai-sdk/openai"
      )
    }
  }

  throw new Error(`Unsupported provider: ${provider}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type createModelFromProvider = (...args: any[]) => any

async function validateRule(
  plan: string,
  rule: LocalRule,
  config: LLMConfig
): Promise<MatchResult> {
  const { z } = await import("zod")
  const { generateObject } = await import("ai")

  const model = await getModel(config)
  const { system, prompt } = buildPrompt(plan, rule)

  const resultSchema = z.object({
    status: z.enum(["PASS", "VIOLATED", "NOT_COVERED"]),
    confidence: z.number().min(0).max(1),
    reason: z.string(),
  })

  const { object } = await generateObject({
    model,
    schema: resultSchema,
    system,
    prompt,
  })

  const validated = object as LLMValidationResult

  return {
    ruleId: rule.id,
    status: validated.status,
    confidence: validated.confidence,
    reason: validated.reason,
  }
}

async function processBatch<T, R>(
  items: readonly T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<readonly R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
  }

  return results
}

export class LLMMatcher implements Matcher {
  readonly name = "llm"
  private readonly config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
  }

  async match(context: MatcherContext): Promise<readonly MatchResult[]> {
    const { plan, rules } = context

    if (rules.length === 0) {
      return []
    }

    const results = await processBatch(
      rules,
      CONCURRENCY_LIMIT,
      (rule) => validateRule(plan, rule, this.config)
    )

    return results
  }
}
