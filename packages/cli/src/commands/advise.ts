import chalk from "chalk"
import { validateCommand } from "./validate.js"
import { diffCommand } from "./diff.js"

export interface AdviseOptions {
  readonly plan?: string
  readonly planFile?: string
  readonly diff?: boolean
  readonly ref?: string
  readonly staged?: boolean
  readonly dir?: string
  readonly llm?: boolean
  readonly format?: "pretty" | "json"
}

export async function adviseCommand(opts: AdviseOptions): Promise<void> {
  console.error(chalk.yellow.bold("rulebound advise"))
  console.error(
    chalk.gray(
      "  Advisory matching only. This is NOT the deterministic gate. Use `rulebound check` to fail builds.",
    ),
  )

  const hasPlan = Boolean(opts.plan || opts.planFile)
  const hasDiff = Boolean(opts.diff || opts.staged || opts.ref)

  if (hasPlan && hasDiff) {
    console.error(chalk.red("Pass either a plan (--plan / --plan-file) or --diff, not both."))
    process.exit(2)
  }
  if (!hasPlan && !hasDiff) {
    console.error(chalk.red("Nothing to review. Pass --plan/--plan-file or --diff."))
    process.exit(2)
  }

  if (hasPlan) {
    await validateCommand({
      ...(opts.plan ? { plan: opts.plan } : {}),
      ...(opts.planFile ? { file: opts.planFile } : {}),
      ...(opts.format ? { format: opts.format } : {}),
      ...(opts.dir ? { dir: opts.dir } : {}),
      ...(opts.llm ? { llm: true } : {}),
    })
    return
  }

  await diffCommand({
    ...(opts.ref ? { ref: opts.ref } : {}),
    ...(opts.staged ? { staged: true } : {}),
    ...(opts.format ? { format: opts.format } : {}),
    ...(opts.dir ? { dir: opts.dir } : {}),
    ...(opts.llm ? { llm: true } : {}),
  })
}
