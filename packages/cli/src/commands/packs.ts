import chalk from "chalk"
import { PACK_REGISTRY, findExamplesRoot, listPackContents } from "../lib/packs.js"

export interface PacksOptions {
  readonly format?: "pretty" | "json"
}

export async function packsListCommand(opts: PacksOptions): Promise<void> {
  const examplesRoot = findExamplesRoot()

  if (opts.format === "json") {
    const data = PACK_REGISTRY.map((p) => ({
      name: p.name,
      description: p.description,
      files: examplesRoot ? listPackContents(p, examplesRoot.path) : [],
    }))
    console.log(JSON.stringify(data, null, 2))
    return
  }

  console.log()
  console.log(chalk.bold("Rule packs"))
  if (!examplesRoot) {
    console.log(chalk.yellow("  (bundled examples not found — file counts unavailable)"))
  }
  console.log()
  for (const pack of PACK_REGISTRY) {
    const files = examplesRoot ? listPackContents(pack, examplesRoot.path) : []
    const count = examplesRoot ? chalk.gray(` (${files.length} file${files.length === 1 ? "" : "s"})`) : ""
    console.log(`  ${chalk.bold(pack.name)}${count}`)
    console.log(chalk.gray(`    ${pack.description}`))
  }
  console.log()
  console.log(chalk.dim("Install with: rulebound init --pack <name> [--pack <name>...]"))
}
