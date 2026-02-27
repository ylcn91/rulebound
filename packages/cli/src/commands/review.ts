import { execSync } from "node:child_process"
import chalk from "chalk"
import { loadAgentsConfig, resolveAgentRules } from "../lib/agents/registry.js"
import type { AgentProfile } from "../lib/agents/registry.js"
import { loadRulesWithInheritance, getProjectConfig } from "../lib/inheritance.js"
import { matchRulesByContext, loadLocalRules, validatePlanAgainstRules } from "../lib/local-rules.js"
import type { LocalRule } from "../lib/local-rules.js"
import { buildConsensus } from "../lib/agents/coordinator.js"
import type { AgentReviewResult } from "../lib/agents/coordinator.js"
import type { MatchResult, MatchStatus } from "../lib/matchers/types.js"

interface ReviewOptions {
  readonly agents?: string
  readonly plan?: string
  readonly diff?: boolean
  readonly llm?: boolean
  readonly dir?: string
}

const STATUS_ICONS: Record<MatchStatus, { readonly icon: string; readonly color: (s: string) => string }> = {
  PASS: { icon: "\u2713", color: chalk.green },
  VIOLATED: { icon: "\u2717", color: chalk.red },
  NOT_COVERED: { icon: "\u25CB", color: chalk.yellow },
}

function getGitDiff(): string | null {
  try {
    const diff = execSync("git diff HEAD", { encoding: "utf-8" })
    return diff.trim() || null
  } catch {
    return null
  }
}

function filterAgentsByNames(agents: readonly AgentProfile[], names: string): readonly AgentProfile[] {
  const requested = names.split(",").map((n) => n.trim().toLowerCase())
  return agents.filter((a) => requested.includes(a.name.toLowerCase()))
}

function convertValidationToMatchResults(
  report: { readonly results: readonly { readonly ruleId: string; readonly status: string; readonly reason: string; readonly suggestedFix?: string }[] }
): readonly MatchResult[] {
  return report.results.map((r) => ({
    ruleId: r.ruleId,
    status: r.status as MatchStatus,
    confidence: r.status === "PASS" ? 1.0 : r.status === "VIOLATED" ? 0.9 : 0.5,
    reason: r.reason,
    ...(r.suggestedFix !== undefined ? { suggestedFix: r.suggestedFix } : {}),
  }))
}

async function runAgentValidation(
  agent: AgentProfile,
  planText: string,
  allRules: readonly LocalRule[],
  useLlm: boolean
): Promise<AgentReviewResult> {
  const allRuleIds = allRules.map((r) => r.id)
  const agentRuleIds = resolveAgentRules(agent, allRuleIds)
  const agentRules = allRules.filter((r) => agentRuleIds.includes(r.id))

  const projectConfig = getProjectConfig(process.cwd())
  const contextRules = matchRulesByContext([...agentRules], projectConfig, planText)

  let matchResults: readonly MatchResult[]

  try {
    const { validateWithPipeline } = await import("../lib/validation.js")
    const report = await validateWithPipeline({
      plan: planText,
      rules: contextRules,
      task: planText.slice(0, 100),
      useLlm,
    })
    matchResults = convertValidationToMatchResults(report)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(chalk.yellow(`Pipeline fallback: ${message}`))
    const report = validatePlanAgainstRules(planText, contextRules, planText.slice(0, 100))
    matchResults = convertValidationToMatchResults(report)
  }

  return {
    agentName: agent.name,
    roles: agent.roles,
    results: matchResults,
  }
}

function printAgentResults(agentResult: AgentReviewResult): void {
  const passCount = agentResult.results.filter((r) => r.status === "PASS").length
  const violatedCount = agentResult.results.filter((r) => r.status === "VIOLATED").length
  const notCoveredCount = agentResult.results.filter((r) => r.status === "NOT_COVERED").length

  const rolesLabel = agentResult.roles.length > 0
    ? chalk.dim(` (${agentResult.roles.join(", ")})`)
    : ""

  console.log(`  ${chalk.white.bold(agentResult.agentName)}${rolesLabel}`)
  console.log(chalk.dim(`    ${agentResult.results.length} rules evaluated`))
  console.log()

  for (const result of agentResult.results) {
    const display = STATUS_ICONS[result.status]
    console.log(`    ${display.color(display.icon)} ${display.color(`[${result.status}]`)} ${result.ruleId}`)
    console.log(chalk.dim(`      ${result.reason}`))

    if (result.suggestedFix) {
      console.log(chalk.yellow(`      \u2192 ${result.suggestedFix}`))
    }
  }

  console.log()
  console.log(
    chalk.dim("    ") +
    chalk.green(`${passCount} pass`) +
    chalk.dim(" | ") +
    chalk.red(`${violatedCount} violated`) +
    chalk.dim(" | ") +
    chalk.yellow(`${notCoveredCount} not covered`)
  )
  console.log()
}

export async function reviewCommand(options: ReviewOptions): Promise<void> {
  // 1. Load agents
  const allAgents = loadAgentsConfig(process.cwd())

  if (allAgents.length === 0) {
    console.error(chalk.red("No agents configured."))
    console.error(chalk.dim("Create .rulebound/agents.json to define agent profiles."))
    process.exit(1)
  }

  const agents = options.agents
    ? filterAgentsByNames(allAgents, options.agents)
    : allAgents

  if (agents.length === 0) {
    console.error(chalk.red("No matching agents found."))
    console.error(chalk.dim(`Available agents: ${allAgents.map((a) => a.name).join(", ")}`))
    process.exit(1)
  }

  // 2. Get plan text
  let planText: string | undefined

  if (options.plan) {
    planText = options.plan
  } else if (options.diff) {
    const diff = getGitDiff()
    if (!diff) {
      console.error(chalk.red("No git diff found. Stage or commit changes first."))
      process.exit(1)
    }
    planText = diff
  }

  if (!planText) {
    console.error(chalk.red("Provide --plan 'text' or --diff to review."))
    process.exit(1)
  }

  // 3. Load all rules
  let allRules: LocalRule[]
  if (options.dir) {
    allRules = loadLocalRules(options.dir)
  } else {
    allRules = loadRulesWithInheritance(process.cwd())
  }

  if (allRules.length === 0) {
    console.error(chalk.red("No rules found."))
    console.error(chalk.dim("Run 'rulebound init' to create rules, or use --dir <path>."))
    process.exit(1)
  }

  // 4. Run per-agent validation
  console.log()
  console.log(chalk.white.bold("MULTI-AGENT REVIEW"))
  console.log(chalk.dim("\u2550".repeat(62)))
  console.log()

  const agentResults: AgentReviewResult[] = []

  for (const agent of agents) {
    const result = await runAgentValidation(agent, planText, allRules, options.llm ?? false)
    agentResults.push(result)

    printAgentResults(result)
    console.log(chalk.dim("\u2500".repeat(62)))
    console.log()
  }

  // 5. Build consensus
  const consensus = buildConsensus(agentResults)

  // 6. Print consensus
  console.log(chalk.white.bold("CONSENSUS"))
  console.log()

  switch (consensus.status) {
    case "PASS":
      console.log(chalk.green.bold(`  ${consensus.summary}`))
      break
    case "FAIL":
      console.log(chalk.red.bold(`  ${consensus.summary}`))
      break
    case "WARN":
      console.log(chalk.yellow.bold(`  ${consensus.summary}`))
      break
  }

  console.log()

  // 7. Exit 1 if FAIL
  if (consensus.status === "FAIL") {
    process.exit(1)
  }
}
