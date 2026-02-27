import { ValidationPipeline } from "./matchers/pipeline.js"
import { KeywordMatcher } from "./matchers/keyword.js"
import { SemanticMatcher } from "./matchers/semantic.js"
import type { LocalRule } from "./local-rules.js"
import type { Matcher } from "./matchers/types.js"
import type { PipelineResult } from "./matchers/types.js"
import type { ValidationReport, ValidationResult } from "./local-rules.js"

interface ValidateOptions {
  readonly plan: string
  readonly rules: readonly LocalRule[]
  readonly task?: string
  readonly useLlm?: boolean
  readonly llmProvider?: "anthropic" | "openai"
  readonly llmModel?: string
}

function buildRuleMap(rules: readonly LocalRule[]): ReadonlyMap<string, LocalRule> {
  const map = new Map<string, LocalRule>()
  for (const rule of rules) {
    map.set(rule.id, rule)
  }
  return map
}

function convertToValidationResult(
  pipelineResult: PipelineResult,
  ruleMap: ReadonlyMap<string, LocalRule>
): readonly ValidationResult[] {
  return pipelineResult.results.map((match) => {
    const rule = ruleMap.get(match.ruleId)

    return {
      ruleId: match.ruleId,
      ruleTitle: rule?.title ?? match.ruleId,
      severity: rule?.severity ?? "warning",
      modality: rule?.modality ?? "should",
      status: match.status,
      reason: match.reason,
      ...(match.suggestedFix !== undefined ? { suggestedFix: match.suggestedFix } : {}),
    }
  })
}

function computeSummary(results: readonly ValidationResult[]): {
  readonly pass: number
  readonly violated: number
  readonly notCovered: number
} {
  let pass = 0
  let violated = 0
  let notCovered = 0

  for (const result of results) {
    switch (result.status) {
      case "PASS":
        pass += 1
        break
      case "VIOLATED":
        violated += 1
        break
      case "NOT_COVERED":
        notCovered += 1
        break
    }
  }

  return { pass, violated, notCovered }
}

function determineStatus(
  results: readonly ValidationResult[]
): "PASSED" | "PASSED_WITH_WARNINGS" | "FAILED" {
  const hasMustViolation = results.some(
    (r) => r.status === "VIOLATED" && r.modality === "must"
  )

  if (hasMustViolation) {
    return "FAILED"
  }

  const hasWarnings = results.some(
    (r) => r.status === "VIOLATED" || r.status === "NOT_COVERED"
  )

  if (hasWarnings) {
    return "PASSED_WITH_WARNINGS"
  }

  return "PASSED"
}

export async function validateWithPipeline(
  options: ValidateOptions
): Promise<ValidationReport> {
  const { plan, rules, task, useLlm, llmProvider, llmModel } = options

  const matchers: Matcher[] = [new KeywordMatcher(), new SemanticMatcher()]

  if (useLlm) {
    try {
      const { LLMMatcher } = await import("./matchers/llm.js")
      matchers.push(
        new LLMMatcher({
          provider: llmProvider ?? "anthropic",
          model: llmModel,
        })
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Failed to load LLM matcher: ${message}. ` +
          "Install AI packages: pnpm add ai @ai-sdk/anthropic"
      )
    }
  }

  const pipeline = new ValidationPipeline(matchers)
  const pipelineResult = await pipeline.run({ plan, rules, task })

  const ruleMap = buildRuleMap(rules)
  const results = convertToValidationResult(pipelineResult, ruleMap)
  const summary = computeSummary(results)
  const status = determineStatus(results)

  return {
    task: task ?? plan.slice(0, 100),
    rulesMatched: results.filter((r) => r.status !== "NOT_COVERED").length,
    rulesTotal: rules.length,
    results: [...results],
    summary: { ...summary },
    status,
  }
}
