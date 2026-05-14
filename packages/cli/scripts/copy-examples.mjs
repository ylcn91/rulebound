#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(__dirname, "..")
const monorepoRoot = resolve(pkgRoot, "..", "..")
const source = resolve(monorepoRoot, "examples", "rules")
const dest = resolve(pkgRoot, "rules", "examples")

if (!existsSync(source)) {
  console.log(`copy-examples: source missing at ${source} — skipping`)
  process.exit(0)
}

rmSync(dest, { recursive: true, force: true })
mkdirSync(dirname(dest), { recursive: true })
cpSync(source, dest, { recursive: true })
console.log(`copy-examples: ${source} → ${dest}`)
