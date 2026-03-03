/**
 * CSS Variable Consistency Check
 *
 * Verifies that every CSS custom property referenced in component/page files
 * is actually declared in globals.css. Runs via ts-node or node --loader ts-node/esm.
 *
 * Usage: npx ts-node --project tsconfig.json __tests__/css-variables.test.ts
 */

import { readFileSync, readdirSync, statSync } from "fs"
import { join, extname, dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ROOT = join(__dirname, "..")
const GLOBALS_CSS = join(ROOT, "app", "globals.css")

// --- Parse declared variables from globals.css ---

function parseDeclaredVariables(css: string): Set<string> {
  const declared = new Set<string>()
  // Match --variable-name: value declarations
  const declarationRegex = /(--[a-zA-Z][a-zA-Z0-9-]*):/g
  let match: RegExpExecArray | null
  while ((match = declarationRegex.exec(css)) !== null) {
    declared.add(match[1])
  }
  return declared
}

// --- Collect all .tsx/.ts source files under app/ and components/ ---

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory() && entry !== "node_modules" && entry !== ".next") {
      collectSourceFiles(full, files)
    } else if (stat.isFile() && (extname(entry) === ".tsx" || extname(entry) === ".ts")) {
      files.push(full)
    }
  }
  return files
}

// --- Parse variables referenced via Tailwind v4 shorthand or var() ---

function parseReferencedVariables(source: string): Set<string> {
  const referenced = new Set<string>()

  // Tailwind v4 shorthand: text-(--color-x), bg-(--color-x), border-(--color-x), etc.
  const tailwindShorthand = /\((-{2}[a-zA-Z][a-zA-Z0-9-]*)\)/g
  let match: RegExpExecArray | null
  while ((match = tailwindShorthand.exec(source)) !== null) {
    referenced.add(match[1])
  }

  // CSS var() references: var(--color-x)
  const varRef = /var\((-{2}[a-zA-Z][a-zA-Z0-9-]*)/g
  while ((match = varRef.exec(source)) !== null) {
    referenced.add(match[1])
  }

  return referenced
}

// --- Run checks ---

function run(): void {
  const cssContent = readFileSync(GLOBALS_CSS, "utf-8")
  const declared = parseDeclaredVariables(cssContent)

  const sourceFiles = [
    ...collectSourceFiles(join(ROOT, "app")),
    ...collectSourceFiles(join(ROOT, "components")),
  ]

  const failures: Array<{ file: string; variable: string }> = []

  for (const file of sourceFiles) {
    const source = readFileSync(file, "utf-8")
    const referenced = parseReferencedVariables(source)

    for (const variable of referenced) {
      if (!declared.has(variable)) {
        failures.push({ file: file.replace(ROOT + "/", ""), variable })
      }
    }
  }

  // Report
  console.log(`Checked ${sourceFiles.length} source files against globals.css`)
  console.log(`Declared variables: ${declared.size}`)
  console.log(
    `  ${[...declared]
      .filter((v) => v.startsWith("--color-") || v.startsWith("--spacing-") || v.startsWith("--font-"))
      .sort()
      .join(", ")}`
  )

  if (failures.length === 0) {
    console.log("\nAll CSS variable references match globals.css declarations.")
    process.exit(0)
  } else {
    console.error(
      `\nFAIL: ${failures.length} undeclared CSS variable reference(s) found:`
    )
    for (const { file, variable } of failures) {
      console.error(`  ${file}: references undeclared ${variable}`)
    }
    process.exit(1)
  }
}

run()
