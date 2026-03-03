import { analyzeCode, getBuiltinQueries, isSupportedLanguage } from "@rulebound/engine"
import type { ASTAnalysisResult } from "@rulebound/engine"

export interface ASTViolation {
  readonly ruleTitle: string
  readonly severity: string
  readonly reason: string
  readonly line: number
  readonly codeSnippet: string
}

const ANNOTATION_MAP: Readonly<Record<string, string>> = {
  typescript: "typescript",
  ts: "typescript",
  javascript: "javascript",
  js: "javascript",
  python: "python",
  py: "python",
  java: "java",
  go: "go",
  golang: "go",
  rust: "rust",
  rs: "rust",
  ruby: "ruby",
  rb: "ruby",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  csharp: "c_sharp",
  cs: "c_sharp",
  cpp: "cpp",
  "c++": "cpp",
}

export function detectLanguageFromAnnotation(annotation: string): string | null {
  const normalized = annotation.trim().toLowerCase()
  return ANNOTATION_MAP[normalized] ?? null
}

export async function scanCodeBlockWithAST(
  code: string,
  language: string,
): Promise<readonly ASTViolation[]> {
  if (!isSupportedLanguage(language)) return []

  const queries = getBuiltinQueries(language).filter((q) => q.language === language)
  if (queries.length === 0) return []

  try {
    const result: ASTAnalysisResult = await analyzeCode(code, language, queries)
    return result.matches.map((m) => ({
      ruleTitle: m.queryName,
      severity: m.severity,
      reason: `AST pattern: ${m.message}`,
      line: m.location.startRow + 1,
      codeSnippet: m.matchedText.slice(0, 200),
    }))
  } catch {
    // AST parsing can fail on incomplete code -- don't crash the gateway
    return []
  }
}
