import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { CheckResult, ForbiddenImportCheck } from "../types.js"
import { globToRegex, listFiles } from "./regex.js"

export interface ImportRunOptions {
  readonly cwd: string
  readonly ruleId: string
  readonly check: ForbiddenImportCheck
}

const IMPORT_PATTERNS: readonly RegExp[] = [
  /import\s+(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/g,
  /require\(["']([^"']+)["']\)/g,
  /import\(["']([^"']+)["']\)/g,
]

function extractImports(source: string): string[] {
  const found: string[] = []
  for (const pattern of IMPORT_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags)
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) {
      found.push(m[1])
    }
  }
  return found
}

export function runImportBoundaryCheck(opts: ImportRunOptions): readonly CheckResult[] {
  const { cwd, ruleId, check } = opts
  const checkId = check.id ?? "forbidden-import"
  const severity = check.severity ?? "error"

  const fromRegs = check.from.map((p) => globToRegex(p))
  const importingRegs = check.importing.map((p) => {
    if (p.endsWith("*")) {
      const escaped = p
        .slice(0, -1)
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      return new RegExp(`^${escaped}`)
    }
    const escaped = p.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`^${escaped}(?:$|/)`)
  })

  const files = listFiles(cwd, ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"]).filter(
    (f) => fromRegs.some((r) => r.test(f)),
  )

  const violations: CheckResult[] = []

  for (const rel of files) {
    let content: string
    try {
      content = readFileSync(join(cwd, rel), "utf-8")
    } catch {
      continue
    }
    const imports = extractImports(content)
    for (const spec of imports) {
      if (importingRegs.some((r) => r.test(spec))) {
        violations.push({
          ruleId,
          checkId,
          status: "VIOLATED",
          source: "import-boundary",
          deterministic: true,
          confidence: "exact",
          blocking: severity === "error",
          reason:
            check.message ??
            `'${rel}' imports from forbidden boundary '${spec}'`,
          evidence: { filePath: rel, snippet: spec },
          ...(check.description ? { suggestedFix: check.description } : {}),
        })
      }
    }
  }

  if (violations.length === 0) {
    return [
      {
        ruleId,
        checkId,
        status: "PASS",
        source: "import-boundary",
        deterministic: true,
        confidence: "exact",
        blocking: false,
        reason: `Boundary respected across ${files.length} files`,
      },
    ]
  }
  return violations
}
