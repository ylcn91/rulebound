import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver/node.js"
import type { ASTMatch, ValidationResult } from "@rulebound/engine"

const SEVERITY_MAP: Readonly<Record<string, DiagnosticSeverity>> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
}

export function matchToDiagnostic(match: ASTMatch): Diagnostic {
  return {
    range: {
      start: {
        line: match.location.startRow,
        character: match.location.startColumn,
      },
      end: {
        line: match.location.endRow,
        character: match.location.endColumn,
      },
    },
    severity: SEVERITY_MAP[match.severity] ?? DiagnosticSeverity.Warning,
    source: "rulebound",
    message: `[${match.queryId}] ${match.message}`,
  }
}

export function validationResultToDiagnostic(
  result: ValidationResult
): Diagnostic {
  const fixSuffix = result.suggestedFix
    ? ` (Fix: ${result.suggestedFix})`
    : ""

  return {
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    },
    severity: SEVERITY_MAP[result.severity] ?? DiagnosticSeverity.Warning,
    source: "rulebound",
    message: `[${result.ruleTitle}] ${result.reason}${fixSuffix}`,
  }
}
