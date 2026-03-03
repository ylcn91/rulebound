import { describe, it, expect, vi } from "vitest"
import { detectLanguageFromAnnotation, scanCodeBlockWithAST } from "../interceptor/ast-scanner.js"

vi.mock("@rulebound/engine", () => ({
  analyzeCode: vi.fn(),
  getBuiltinQueries: vi.fn(),
  isSupportedLanguage: vi.fn(),
}))

import { analyzeCode, getBuiltinQueries, isSupportedLanguage } from "@rulebound/engine"

const mockAnalyzeCode = vi.mocked(analyzeCode)
const mockGetBuiltinQueries = vi.mocked(getBuiltinQueries)
const mockIsSupportedLanguage = vi.mocked(isSupportedLanguage)

describe("detectLanguageFromAnnotation", () => {
  it("maps 'typescript' to 'typescript'", () => {
    expect(detectLanguageFromAnnotation("typescript")).toBe("typescript")
  })

  it("maps 'ts' to 'typescript'", () => {
    expect(detectLanguageFromAnnotation("ts")).toBe("typescript")
  })

  it("maps 'py' to 'python'", () => {
    expect(detectLanguageFromAnnotation("py")).toBe("python")
  })

  it("maps 'golang' to 'go'", () => {
    expect(detectLanguageFromAnnotation("golang")).toBe("go")
  })

  it("maps 'cs' to 'c_sharp'", () => {
    expect(detectLanguageFromAnnotation("cs")).toBe("c_sharp")
  })

  it("returns null for unknown annotation", () => {
    expect(detectLanguageFromAnnotation("unknown")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(detectLanguageFromAnnotation("")).toBeNull()
  })

  it("handles whitespace and casing", () => {
    expect(detectLanguageFromAnnotation("  TypeScript  ")).toBe("typescript")
  })
})

describe("scanCodeBlockWithAST", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns violations for supported language with matches", async () => {
    mockIsSupportedLanguage.mockReturnValue(true)
    mockGetBuiltinQueries.mockReturnValue([
      {
        id: "ts-no-any",
        name: "No 'any' Type",
        description: "Disallow 'any'",
        language: "typescript",
        severity: "error",
        category: "style",
        query: "(predefined_type) @type",
        message: "Use 'unknown' instead of 'any'",
      },
    ])
    mockAnalyzeCode.mockResolvedValue({
      language: "typescript",
      matches: [
        {
          queryId: "ts-no-any",
          queryName: "No 'any' Type",
          message: "Use 'unknown' instead of 'any'",
          severity: "error",
          location: { startRow: 0, startColumn: 10, endRow: 0, endColumn: 13 },
          matchedText: "any",
          capturedNodes: [],
        },
      ],
      parseErrors: 0,
      nodeCount: 5,
      parseTimeMs: 1,
      queryTimeMs: 1,
    })

    const violations = await scanCodeBlockWithAST("const x: any = 1", "typescript")

    expect(violations).toHaveLength(1)
    expect(violations[0].ruleTitle).toBe("No 'any' Type")
    expect(violations[0].severity).toBe("error")
    expect(violations[0].reason).toBe("AST pattern: Use 'unknown' instead of 'any'")
    expect(violations[0].line).toBe(1)
    expect(violations[0].codeSnippet).toBe("any")
  })

  it("returns empty for unsupported language", async () => {
    mockIsSupportedLanguage.mockReturnValue(false)

    const violations = await scanCodeBlockWithAST("some code", "fortran")

    expect(violations).toEqual([])
    expect(mockAnalyzeCode).not.toHaveBeenCalled()
  })

  it("returns empty when no queries exist for language", async () => {
    mockIsSupportedLanguage.mockReturnValue(true)
    mockGetBuiltinQueries.mockReturnValue([
      {
        id: "ts-no-any",
        name: "No 'any' Type",
        description: "Disallow 'any'",
        language: "typescript",
        severity: "error",
        category: "style",
        query: "(predefined_type) @type",
        message: "Use 'unknown' instead of 'any'",
      },
    ])

    const violations = await scanCodeBlockWithAST("some code", "python")

    expect(violations).toEqual([])
    expect(mockAnalyzeCode).not.toHaveBeenCalled()
  })

  it("returns empty when analyzeCode throws", async () => {
    mockIsSupportedLanguage.mockReturnValue(true)
    mockGetBuiltinQueries.mockReturnValue([
      {
        id: "ts-no-any",
        name: "No 'any' Type",
        description: "Disallow 'any'",
        language: "typescript",
        severity: "error",
        category: "style",
        query: "(predefined_type) @type",
        message: "Use 'unknown' instead of 'any'",
      },
    ])
    mockAnalyzeCode.mockRejectedValue(new Error("Parse failed"))

    const violations = await scanCodeBlockWithAST("broken code {{{", "typescript")

    expect(violations).toEqual([])
  })
})
