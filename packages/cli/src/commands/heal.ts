import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import chalk from "chalk"
import { findRulesDir, loadRulesWithInheritance, validateDeterministic } from "@rulebound/engine"

export interface HealOptions {
  readonly dir?: string
  readonly maxIterations?: string
  readonly check?: string
  readonly format?: "json" | "pretty"
  readonly allowCommands?: boolean
  readonly cmd?: string
}

export async function healCommand(opts: HealOptions): Promise<void> {
  const cwd = process.cwd()
  const rulesDir = opts.dir ? resolve(cwd, opts.dir) : findRulesDir(cwd)
  if (!rulesDir) {
    console.error(chalk.red("No rules directory. Run 'rulebound init'."))
    process.exit(2)
  }
  const rules = loadRulesWithInheritance(cwd, opts.dir ? rulesDir : undefined)

  const max = Math.max(1, Math.min(10, parseInt(opts.maxIterations ?? "3", 10)))
  const log: { iteration: number; status: string; violations: number; rerun: boolean }[] = []

  for (let i = 1; i <= max; i++) {
    const report = await validateDeterministic({
      cwd,
      rules,
      allowCommandExecution: opts.allowCommands ?? false,
    })
    log.push({
      iteration: i,
      status: report.status,
      violations: report.summary.violated,
      rerun: i < max && report.status === "FAILED",
    })

    if (report.status !== "FAILED") {
      if (opts.format === "json") {
        console.log(JSON.stringify({ status: "GREEN", log, finalReport: report }, null, 2))
      } else {
        console.log(chalk.green(`heal: green on iteration ${i}`))
      }
      process.exit(0)
    }

    if (i === max) {
      if (opts.format === "json") {
        console.log(JSON.stringify({ status: "EXHAUSTED", log, finalReport: report }, null, 2))
      } else {
        console.log(chalk.red(`heal: still failing after ${max} iterations`))
      }
      process.exit(1)
    }

    if (opts.cmd) {
      console.error(chalk.cyan(`heal[${i}]: running repair command...`))
      spawnSync("/bin/sh", ["-c", opts.cmd], { cwd, stdio: "inherit" })
    } else {
      console.error(chalk.yellow(`heal[${i}]: no --cmd provided; rerun deterministic checks only`))
    }
  }
}
