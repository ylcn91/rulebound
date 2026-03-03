import { describe, it, expect } from "vitest"
import { DiagnosticSeverity } from "vscode-languageserver/node.js"
import { matchToDiagnostic, validationResultToDiagnostic } from "../src/diagnostics.js"
import type { ASTMatch, ValidationResult } from "@rulebound/engine"

function createASTMatch(overrides: Partial<ASTMatch> = {}): ASTMatch {
  return {
    queryId: "test-query",
    queryName: "Test Query",
    message: "Test violation detected",
    severity: "warning",
    location: {
      startRow: 5,
      startColumn: 10,
      endRow: 5,
      endColumn: 25,
    },
    matchedText: "badCode()",
    capturedNodes: [],
    ...overrides,
  }
}

function createValidationResult(
  overrides: Partial<ValidationResult> = {}
): ValidationResult {
  return {
    ruleId: "rule-001",
    ruleTitle: "No Console Logs",
    severity: "warning",
    modality: "must",
    status: "VIOLATED",
    reason: "Console.log found in production code",
    ...overrides,
  }
}

describe("matchToDiagnostic", () => {
  it("converts ASTMatch location to correct LSP Range", () => {
    const match = createASTMatch({
      location: {
        startRow: 10,
        startColumn: 4,
        endRow: 12,
        endColumn: 20,
      },
    })

    const diagnostic = matchToDiagnostic(match)

    expect(diagnostic.range).toEqual({
      start: { line: 10, character: 4 },
      end: { line: 12, character: 20 },
    })
  })

  it("maps severity 'error' to DiagnosticSeverity.Error (1)", () => {
    const match = createASTMatch({ severity: "error" })
    const diagnostic = matchToDiagnostic(match)
    expect(diagnostic.severity).toBe(DiagnosticSeverity.Error)
  })

  it("maps severity 'warning' to DiagnosticSeverity.Warning (2)", () => {
    const match = createASTMatch({ severity: "warning" })
    const diagnostic = matchToDiagnostic(match)
    expect(diagnostic.severity).toBe(DiagnosticSeverity.Warning)
  })

  it("maps severity 'info' to DiagnosticSeverity.Information (3)", () => {
    const match = createASTMatch({ severity: "info" })
    const diagnostic = matchToDiagnostic(match)
    expect(diagnostic.severity).toBe(DiagnosticSeverity.Information)
  })

  it("sets source to 'rulebound'", () => {
    const match = createASTMatch()
    const diagnostic = matchToDiagnostic(match)
    expect(diagnostic.source).toBe("rulebound")
  })

  it("includes queryId and message in diagnostic message", () => {
    const match = createASTMatch({
      queryId: "no-eval",
      message: "Avoid using eval()",
    })
    const diagnostic = matchToDiagnostic(match)
    expect(diagnostic.message).toBe("[no-eval] Avoid using eval()")
  })
})

describe("validationResultToDiagnostic", () => {
  it("maps severity 'error' to DiagnosticSeverity.Error (1)", () => {
    const result = createValidationResult({ severity: "error" })
    const diagnostic = validationResultToDiagnostic(result)
    expect(diagnostic.severity).toBe(DiagnosticSeverity.Error)
  })

  it("maps severity 'warning' to DiagnosticSeverity.Warning (2)", () => {
    const result = createValidationResult({ severity: "warning" })
    const diagnostic = validationResultToDiagnostic(result)
    expect(diagnostic.severity).toBe(DiagnosticSeverity.Warning)
  })

  it("maps severity 'info' to DiagnosticSeverity.Information (3)", () => {
    const result = createValidationResult({ severity: "info" })
    const diagnostic = validationResultToDiagnostic(result)
    expect(diagnostic.severity).toBe(DiagnosticSeverity.Information)
  })

  it("defaults unknown severity to Warning", () => {
    const result = createValidationResult({ severity: "unknown" })
    const diagnostic = validationResultToDiagnostic(result)
    expect(diagnostic.severity).toBe(DiagnosticSeverity.Warning)
  })

  it("sets source to 'rulebound'", () => {
    const result = createValidationResult()
    const diagnostic = validationResultToDiagnostic(result)
    expect(diagnostic.source).toBe("rulebound")
  })

  it("includes ruleTitle and reason in message", () => {
    const result = createValidationResult({
      ruleTitle: "No Hardcoded Secrets",
      reason: "API key found in source",
    })
    const diagnostic = validationResultToDiagnostic(result)
    expect(diagnostic.message).toBe(
      "[No Hardcoded Secrets] API key found in source"
    )
  })

  it("appends suggestedFix to message when present", () => {
    const result = createValidationResult({
      ruleTitle: "No Console Logs",
      reason: "Console.log found",
      suggestedFix: "Use a logger instead",
    })
    const diagnostic = validationResultToDiagnostic(result)
    expect(diagnostic.message).toBe(
      "[No Console Logs] Console.log found (Fix: Use a logger instead)"
    )
  })

  it("omits fix suffix when suggestedFix is absent", () => {
    const result = createValidationResult({
      ruleTitle: "No Eval",
      reason: "eval() is dangerous",
      suggestedFix: undefined,
    })
    const diagnostic = validationResultToDiagnostic(result)
    expect(diagnostic.message).toBe("[No Eval] eval() is dangerous")
    expect(diagnostic.message).not.toContain("Fix:")
  })

  it("places diagnostic range at document start (line 0, char 0)", () => {
    const result = createValidationResult()
    const diagnostic = validationResultToDiagnostic(result)
    expect(diagnostic.range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    })
  })
})
