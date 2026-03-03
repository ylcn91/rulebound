import { validate, type Rule, type ValidationReport } from "@rulebound/engine"

const CODE_BLOCK_REGEX = /```[\w]*\n([\s\S]*?)```/g

export function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = []
  let match: RegExpExecArray | null
  CODE_BLOCK_REGEX.lastIndex = 0
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    blocks.push(match[1].trim())
  }
  return blocks
}

export interface ScanResult {
  hasViolations: boolean
  violations: Array<{
    ruleTitle: string
    severity: string
    reason: string
    suggestedFix?: string
    codeSnippet: string
  }>
  report?: ValidationReport
}

export async function scanResponse(
  responseText: string,
  rules: Rule[],
): Promise<ScanResult> {
  if (rules.length === 0) {
    return { hasViolations: false, violations: [] }
  }

  const codeBlocks = extractCodeBlocks(responseText)
  if (codeBlocks.length === 0) {
    return { hasViolations: false, violations: [] }
  }

  const allCode = codeBlocks.join("\n\n")
  const report = await validate({ plan: allCode, rules, task: "LLM response code validation" })

  const violations = report.results
    .filter((r) => r.status === "VIOLATED")
    .map((r) => ({
      ruleTitle: r.ruleTitle,
      severity: r.severity,
      reason: r.reason,
      suggestedFix: r.suggestedFix,
      codeSnippet: allCode.slice(0, 200),
    }))

  return {
    hasViolations: violations.length > 0,
    violations,
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
