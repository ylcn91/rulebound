import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createInterface } from "node:readline"
import chalk from "chalk"
import type { AgentType, ProjectConfig } from "@rulebound/shared"
import { getServerUrl, setCurrentProject } from "../lib/config.js"

const AGENTS: { name: string; value: AgentType }[] = [
  { name: "Claude Code", value: "claude-code" },
  { name: "Cursor", value: "cursor" },
  { name: "Copilot", value: "copilot" },
]

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export async function setupCommand(): Promise<void> {
  const configPath = resolve(process.cwd(), ".rulebound.json")

  if (existsSync(configPath)) {
    const overwrite = await prompt(
      chalk.yellow(
        ".rulebound.json already exists. Overwrite? (y/N): "
      )
    )
    if (overwrite.toLowerCase() !== "y") {
      console.log(chalk.dim("Setup cancelled."))
      return
    }
  }

  console.log(chalk.blue("RULEBOUND PROJECT SETUP"))
  console.log(chalk.dim("─".repeat(40)))
  console.log()

  const projectName = await prompt(chalk.white("Project name: "))
  if (!projectName) {
    console.error(chalk.red("Project name is required."))
    process.exit(1)
  }

  console.log()
  console.log(chalk.white("Select agents to connect:"))
  AGENTS.forEach((agent, i) => {
    console.log(chalk.dim(`  ${i + 1}. ${agent.name}`))
  })
  console.log()

  const agentInput = await prompt(
    chalk.white("Enter numbers (comma-separated, e.g. 1,2): ")
  )

  const selectedAgents: AgentType[] = agentInput
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => n >= 1 && n <= AGENTS.length)
    .map((n) => AGENTS[n - 1].value)

  if (selectedAgents.length === 0) {
    console.error(chalk.red("At least one agent must be selected."))
    process.exit(1)
  }

  const config: ProjectConfig = {
    projectName,
    agents: selectedAgents,
    serverUrl: getServerUrl(),
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
  setCurrentProject(projectName)

  console.log()
  console.log(chalk.green("Project configured successfully."))
  console.log(chalk.dim(`  Config: ${configPath}`))
  console.log(
    chalk.dim(
      `  Agents: ${selectedAgents.map((a) => AGENTS.find((ag) => ag.value === a)?.name).join(", ")}`
    )
  )
}
