import { validate, type Rule, type ValidationReport } from "@rulebound/engine"
import {
  scanCodeBlockWithAST,
  detectLanguageFromAnnotation,
  type ASTViolation,
} from "./ast-scanner.js"
import {
  buildEnforcementSummary,
  type EnforcementSummary,
  type GatewayViolation,
} from "./enforcement.js"

const CODE_BLOCK_REGEX = /```(\w*)\n([\s\S]*?)```/g

export interface CodeBlock {
  readonly code: string
  readonly language: string | null
}

export function extractCodeBlocks(text: string): readonly CodeBlock[] {
  const blocks: CodeBlock[] = []
  let match: RegExpExecArray | null
  CODE_BLOCK_REGEX.lastIndex = 0
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    blocks.push({
      code: match[2].trim(),
      language: match[1] || null,
    })
  }
  return blocks
}

export interface ScanResult {
  codeBlockCount: number
  hasViolations: boolean
  violations: GatewayViolation[]
  enforcement: EnforcementSummary
  report?: ValidationReport
}

export async function scanResponse(
  responseText: string,
  rules: Rule[],
): Promise<ScanResult> {
  const codeBlocks = extractCodeBlocks(responseText)
  if (codeBlocks.length === 0) {
    return {
      codeBlockCount: 0,
      hasViolations: false,
      violations: [],
      enforcement: buildEnforcementSummary(undefined, []),
    }
  }

  // Semantic validation (existing)
  const allCode = codeBlocks.map((b) => b.code).join("\n\n")

  let semanticViolations: ScanResult["violations"] = []
  let report: ValidationReport | undefined
  if (rules.length > 0) {
    report = await validate({ plan: allCode, rules, task: "LLM response code validation" })
    semanticViolations = report.results
      .filter((r) => r.status === "VIOLATED")
      .map((r) => ({
        ruleId: r.ruleId,
        ruleTitle: r.ruleTitle,
        severity: r.severity,
        reason: r.reason,
        suggestedFix: r.suggestedFix,
        codeSnippet: allCode.slice(0, 200),
        source: "semantic" as const,
        modality: normalizeSemanticModality(r.modality),
      }))
  }

  // AST analysis (new)
  const astMatches: ASTViolation[] = []
  const astViolations: typeof semanticViolations = []
  for (const block of codeBlocks) {
    const lang = block.language ? detectLanguageFromAnnotation(block.language) : null
    if (!lang) continue
    const matches = await scanCodeBlockWithAST(block.code, lang)
    astMatches.push(...matches)
    for (const m of matches) {
      astViolations.push({
        ruleId: m.ruleId,
        ruleTitle: m.ruleTitle,
        severity: m.severity,
        reason: m.reason,
        codeSnippet: m.codeSnippet,
        source: "ast",
        modality: m.severity === "error" ? "must" : "should",
      })
    }
  }

  const violations = [...semanticViolations, ...astViolations]
  return {
    codeBlockCount: codeBlocks.length,
    hasViolations: violations.length > 0,
    violations,
    enforcement: buildEnforcementSummary(report, astMatches),
    report,
  }
}

export function buildViolationWarning(violations: ScanResult["violations"]): string {
  if (violations.length === 0) return ""

  const lines = [
    "",
    "---",
    "**Rulebound: Rule violations detected in the code above:**",
    "",
  ]

  for (const v of violations) {
    const icon = v.severity === "error" ? "[ERROR]" : "[WARNING]"
    lines.push(`${icon} **${v.ruleTitle}**: ${v.reason}`)
    if (v.suggestedFix) lines.push(`  Fix: ${v.suggestedFix}`)
  }

  lines.push("")
  lines.push("Please review and fix these violations before using this code.")
  lines.push("---")

  return lines.join("\n")
}

function normalizeSemanticModality(modality: string): "must" | "should" | "may" {
  if (modality === "must" || modality === "should" || modality === "may") {
    return modality
  }
  return "may"
}
