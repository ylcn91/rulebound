import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { AstCheck, CheckResult } from "../types.js"
import { listFiles } from "./regex.js"
import { analyzeWithBuiltins } from "../../ast/analyzer.js"
import { isSupportedLanguage, detectLanguageFromPath } from "../../ast/parser-manager.js"
import type { SupportedLanguage } from "../../ast/types.js"

export interface AstRunOptions {
  readonly cwd: string
  readonly ruleId: string
  readonly check: AstCheck
  readonly fileAllowList?: readonly string[]
}

const LANG_GLOBS: Record<string, readonly string[]> = {
  typescript: ["**/*.ts", "**/*.tsx"],
  javascript: ["**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"],
  python: ["**/*.py"],
  java: ["**/*.java"],
  go: ["**/*.go"],
  rust: ["**/*.rs"],
  csharp: ["**/*.cs"],
  ruby: ["**/*.rb"],
  cpp: ["**/*.cpp", "**/*.cc", "**/*.cxx", "**/*.hpp", "**/*.h"],
}

export async function runAstCheck(opts: AstRunOptions): Promise<readonly CheckResult[]> {
  const { cwd, ruleId, check, fileAllowList } = opts
  const checkId = check.id ?? `ast:${check.builtin ?? check.language}`
  const severity = check.severity ?? "warning"

  if (!isSupportedLanguage(check.language)) {
    return [
      {
        ruleId,
        checkId,
        status: "ERROR",
        source: "ast",
        deterministic: true,
        confidence: "exact",
        blocking: false,
        reason: `Language not supported by AST engine: ${check.language}`,
      },
    ]
  }

  const language = check.language as SupportedLanguage
  const globs = fileAllowList ?? LANG_GLOBS[language] ?? []
  const candidateFiles = listFiles(cwd, globs).filter((f) => detectLanguageFromPath(f) === language)

  const results: CheckResult[] = []

  for (const rel of candidateFiles) {
    let source: string
    try {
      source = readFileSync(join(cwd, rel), "utf-8")
    } catch {
      continue
    }
    let analysis
    try {
      analysis = await analyzeWithBuiltins(source, language)
    } catch (error) {
      results.push({
        ruleId,
        checkId,
        status: "ERROR",
        source: "ast",
        deterministic: true,
        confidence: "exact",
        blocking: false,
        reason: `AST analysis failed for ${rel}: ${error instanceof Error ? error.message : String(error)}`,
        evidence: { filePath: rel },
      })
      continue
    }
    const matches = check.builtin
      ? analysis.matches.filter((m) => m.queryId === check.builtin)
      : analysis.matches
    for (const m of matches) {
      results.push({
        ruleId,
        checkId,
        status: "VIOLATED",
        source: "ast",
        deterministic: true,
        confidence: "exact",
        blocking: severity === "error",
        reason: check.message ?? m.message,
        evidence: {
          filePath: rel,
          line: m.location.startRow + 1,
          column: m.location.startColumn,
        },
      })
    }
  }

  if (results.length === 0) {
    results.push({
      ruleId,
      checkId,
      status: "PASS",
      source: "ast",
      deterministic: true,
      confidence: "exact",
      blocking: false,
      reason: `AST check passed across ${candidateFiles.length} ${language} files`,
    })
  }
  return results
}
