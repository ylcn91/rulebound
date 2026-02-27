import chalk from "chalk"
import { loadAgentsConfig } from "../lib/agents/registry.js"

export async function listAgentsCommand(): Promise<void> {
  const agents = loadAgentsConfig(process.cwd())

  if (agents.length === 0) {
    console.log(chalk.dim("No agents configured."))
    console.log(chalk.dim("Create .rulebound/agents.json to define agent profiles."))
    return
  }

  console.log()
  console.log(chalk.white.bold("AGENT PROFILES"))
  console.log(chalk.dim("\u2500".repeat(50)))
  console.log()

  for (const agent of agents) {
    console.log(`  ${chalk.white.bold(agent.name)}`)
    if (agent.roles.length > 0) {
      console.log(chalk.dim(`    Roles: ${agent.roles.join(", ")}`))
    }
    console.log(chalk.dim(`    Rules: ${agent.rules.join(", ")}`))
    console.log(chalk.dim(`    Enforcement: ${agent.enforcement}`))
    console.log()
  }
}
