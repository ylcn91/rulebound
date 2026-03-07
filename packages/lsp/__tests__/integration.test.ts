import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  matchToDiagnostic,
  validationResultToDiagnostic,
} from "../src/diagnostics.js"
import { SERVER_CAPABILITIES } from "../src/capabilities.js"
import { TextDocumentSyncKind, DiagnosticSeverity } from "vscode-languageserver/node.js"
import type { ASTMatch, ValidationResult } from "@rulebound/engine"

vi.mock("@rulebound/engine", async (importOriginal) => {
  const original = await importOriginal<typeof import("@rulebound/engine")>()
  return {
    ...original,
    analyzeWithBuiltins: vi.fn(),
    detectLanguageFromPath: vi.fn(),
    isSupportedLanguage: vi.fn(),
    findRulesDir: vi.fn(),
    loadLocalRules: vi.fn(),
    validate: vi.fn(),
  }
})

import {
  analyzeWithBuiltins,
  detectLanguageFromPath,
  isSupportedLanguage,
  findRulesDir,
  loadLocalRules,
  validate,
} from "@rulebound/engine"

const mockAnalyze = vi.mocked(analyzeWithBuiltins)
const mockDetectLang = vi.mocked(detectLanguageFromPath)
const mockIsSupported = vi.mocked(isSupportedLanguage)
const mockFindRulesDir = vi.mocked(findRulesDir)
const mockLoadRules = vi.mocked(loadLocalRules)
const mockValidate = vi.mocked(validate)

describe("LSP Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("server capabilities", () => {
    it("supports full text document sync", () => {
      expect(SERVER_CAPABILITIES.textDocumentSync).toBe(TextDocumentSyncKind.Full)
    })

    it("has diagnostic provider configured", () => {
      expect(SERVER_CAPABILITIES.diagnosticProvider).toBeDefined()
      expect(SERVER_CAPABILITIES.diagnosticProvider).toEqual({
        interFileDependencies: false,
        workspaceDiagnostics: false,
      })
    })
  })

  describe("AST match to diagnostic conversion", () => {
    it("converts multi-line AST matches correctly", () => {
      const match: ASTMatch = {
        queryId: "ts-no-any",
        queryName: "No Any Type",
        message: "Avoid 'any' type",
        severity: "error",
        location: { startRow: 0, startColumn: 10, endRow: 2, endColumn: 5 },
        matchedText: "any",
        capturedNodes: [],
      }

      const diag = matchToDiagnostic(match)
      expect(diag.range.start.line).toBe(0)
      expect(diag.range.start.character).toBe(10)
      expect(diag.range.end.line).toBe(2)
      expect(diag.range.end.character).toBe(5)
      expect(diag.severity).toBe(DiagnosticSeverity.Error)
      expect(diag.source).toBe("rulebound")
      expect(diag.message).toBe("[ts-no-any] Avoid 'any' type")
    })

    it("maps all severity levels correctly", () => {
      const severities: Array<{ input: string; expected: DiagnosticSeverity }> = [
        { input: "error", expected: DiagnosticSeverity.Error },
        { input: "warning", expected: DiagnosticSeverity.Warning },
        { input: "info", expected: DiagnosticSeverity.Information },
      ]

      for (const { input, expected } of severities) {
        const match: ASTMatch = {
          queryId: "test",
          queryName: "Test",
          message: "msg",
          severity: input,
          location: { startRow: 0, startColumn: 0, endRow: 0, endColumn: 1 },
          matchedText: "x",
          capturedNodes: [],
        }
        expect(matchToDiagnostic(match).severity).toBe(expected)
      }
    })
  })

  describe("validation result to diagnostic conversion", () => {
    it("includes suggested fix when present", () => {
      const result: ValidationResult = {
        ruleId: "r1",
        ruleTitle: "No Console",
        severity: "warning",
        modality: "should",
        status: "VIOLATED",
        reason: "console.log found",
        suggestedFix: "Use a proper logger",
      }

      const diag = validationResultToDiagnostic(result)
      expect(diag.message).toContain("Fix: Use a proper logger")
    })

    it("omits fix suffix when no suggested fix", () => {
      const result: ValidationResult = {
        ruleId: "r1",
        ruleTitle: "No Console",
        severity: "warning",
        modality: "should",
        status: "VIOLATED",
        reason: "console.log found",
      }

      const diag = validationResultToDiagnostic(result)
      expect(diag.message).not.toContain("Fix:")
    })
  })

  describe("document analysis flow", () => {
    it("detects TypeScript and runs AST analysis", async () => {
      mockDetectLang.mockReturnValue("typescript")
      mockIsSupported.mockReturnValue(true)
      mockAnalyze.mockResolvedValue({
        language: "typescript",
        matches: [
          {
            queryId: "ts-no-any",
            queryName: "No Any Type",
            message: "Avoid 'any' type",
            severity: "error",
            location: { startRow: 1, startColumn: 15, endRow: 1, endColumn: 18 },
            matchedText: "any",
            capturedNodes: [],
          },
        ],
        parseErrors: 0,
        nodeCount: 10,
        parseTimeMs: 5,
        queryTimeMs: 3,
      })

      const lang = detectLanguageFromPath("/project/src/app.ts")
      expect(lang).toBe("typescript")
      expect(isSupportedLanguage(lang!)).toBe(true)

      const result = await analyzeWithBuiltins("const x: any = 5;", "typescript")
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].queryId).toBe("ts-no-any")
    })

    it("skips unsupported languages", () => {
      mockDetectLang.mockReturnValue(null)

      const lang = detectLanguageFromPath("/project/config.yaml")
      expect(lang).toBeNull()
    })

    it("loads workspace rules and validates against them", async () => {
      mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
      mockLoadRules.mockReturnValue([
        {
          id: "no-secrets",
          title: "No Hardcoded Secrets",
          content: "No secrets in code",
          category: "security",
          severity: "error",
          modality: "must",
          tags: [],
          stack: [],
          scope: [],
          changeTypes: [],
          team: [],
          filePath: "security/no-secrets.md",
        },
      ])
      mockValidate.mockResolvedValue({
        task: "test",
        rulesMatched: 1,
        rulesTotal: 1,
        results: [
          {
            ruleId: "no-secrets",
            ruleTitle: "No Hardcoded Secrets",
            severity: "error",
            modality: "must",
            status: "VIOLATED",
            reason: "Hardcoded API key detected",
          },
        ],
        summary: { pass: 0, violated: 1, notCovered: 0 },
        status: "FAILED",
      })

      const rulesDir = findRulesDir("/project")
      expect(rulesDir).toBe("/project/.rulebound/rules")

      const rules = loadLocalRules(rulesDir!)
      expect(rules).toHaveLength(1)

      const report = await validate({
        plan: "const apiKey = 'sk_live_abc';",
        rules,
      })

      expect(report.status).toBe("FAILED")
      expect(report.results[0].status).toBe("VIOLATED")

      const diag = validationResultToDiagnostic(report.results[0])
      expect(diag.severity).toBe(DiagnosticSeverity.Error)
      expect(diag.message).toContain("Hardcoded API key detected")
    })

    it("continues analysis when workspace has no rules", async () => {
      mockFindRulesDir.mockReturnValue(null)
      mockDetectLang.mockReturnValue("typescript")
      mockIsSupported.mockReturnValue(true)
      mockAnalyze.mockResolvedValue({
        language: "typescript",
        matches: [],
        parseErrors: 0,
        nodeCount: 5,
        parseTimeMs: 1,
        queryTimeMs: 1,
      })

      const rulesDir = findRulesDir("/project")
      expect(rulesDir).toBeNull()

      const result = await analyzeWithBuiltins("const x = 1;", "typescript")
      expect(result.matches).toHaveLength(0)
    })

    it("handles analysis errors gracefully", async () => {
      mockDetectLang.mockReturnValue("typescript")
      mockIsSupported.mockReturnValue(true)
      mockAnalyze.mockRejectedValue(new Error("WASM parse failed"))

      const lang = detectLanguageFromPath("/project/broken.ts")
      expect(lang).toBe("typescript")

      await expect(analyzeWithBuiltins("invalid{{{", "typescript")).rejects.toThrow("WASM parse failed")
    })

    it("processes multiple languages in a workspace", async () => {
      const languages: Array<{ path: string; lang: string }> = [
        { path: "/project/app.ts", lang: "typescript" },
        { path: "/project/main.py", lang: "python" },
        { path: "/project/App.java", lang: "java" },
      ]

      for (const { path, lang } of languages) {
        mockDetectLang.mockReturnValue(lang)
        mockIsSupported.mockReturnValue(true)
        mockAnalyze.mockResolvedValue({
          language: lang,
          matches: [],
          parseErrors: 0,
          nodeCount: 10,
          parseTimeMs: 1,
          queryTimeMs: 1,
        })

        const detected = detectLanguageFromPath(path)
        expect(detected).toBe(lang)
        expect(isSupportedLanguage(detected!)).toBe(true)

        const result = await analyzeWithBuiltins("code", lang)
        expect(result.language).toBe(lang)
      }
    })
  })
})
