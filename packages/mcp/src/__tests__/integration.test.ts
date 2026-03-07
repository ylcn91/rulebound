import { describe, it, expect, vi, beforeEach } from "vitest"
import type { LocalRule, ValidationReport } from "../types.js"

vi.mock("../rule-loader.js", () => ({
  findRulesDir: vi.fn(),
  loadLocalRules: vi.fn(),
  filterRules: vi.fn(),
  validatePlanAgainstRules: vi.fn(),
  detectLanguageFromCode: vi.fn(),
  detectProjectStack: vi.fn(() => []),
}))

vi.mock("@rulebound/engine", () => ({
  detectLanguageFromPath: vi.fn(),
  isSupportedLanguage: vi.fn(),
  analyzeWithBuiltins: vi.fn(),
}))

import {
  findRulesDir,
  loadLocalRules,
  filterRules,
  validatePlanAgainstRules,
  detectProjectStack,
} from "../rule-loader.js"

import {
  detectLanguageFromPath,
  isSupportedLanguage,
  analyzeWithBuiltins,
} from "@rulebound/engine"

const mockFindRulesDir = vi.mocked(findRulesDir)
const mockLoadLocalRules = vi.mocked(loadLocalRules)
const mockFilterRules = vi.mocked(filterRules)
const mockValidatePlan = vi.mocked(validatePlanAgainstRules)
const mockDetectStack = vi.mocked(detectProjectStack)
const mockDetectLangFromPath = vi.mocked(detectLanguageFromPath)
const mockIsSupportedLanguage = vi.mocked(isSupportedLanguage)
const mockAnalyzeWithBuiltins = vi.mocked(analyzeWithBuiltins)

function makeRule(overrides: Partial<LocalRule> = {}): LocalRule {
  return {
    id: "test-rule",
    title: "Test Rule",
    content: "Must follow this rule",
    category: "security",
    severity: "error",
    modality: "must",
    tags: ["test"],
    stack: [],
    filePath: "test-rule.md",
    ...overrides,
  }
}

function makeReport(overrides: Partial<ValidationReport> = {}): ValidationReport {
  return {
    task: "test",
    rulesTotal: 1,
    results: [],
    summary: { pass: 0, violated: 0, notCovered: 0 },
    status: "PASSED",
    ...overrides,
  }
}

describe("MCP Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDetectStack.mockReturnValue([])
  })

  describe("find_rules full flow", () => {
    it("auto-detects project stack and filters rules accordingly", () => {
      mockDetectStack.mockReturnValue(["typescript", "javascript"])
      mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
      const allRules = [
        makeRule({ id: "ts-strict", title: "Strict Types", stack: ["typescript"] }),
        makeRule({ id: "java-di", title: "Constructor DI", stack: ["java"] }),
        makeRule({ id: "global-secrets", title: "No Secrets", stack: [] }),
      ]
      mockLoadLocalRules.mockReturnValue(allRules)
      mockFilterRules.mockImplementation((rules, opts) => {
        if (opts.stack) {
          const stackList = opts.stack.split(",").map((s: string) => s.toLowerCase())
          return rules.filter((r) =>
            r.stack.length === 0 || r.stack.some((s: string) => stackList.includes(s.toLowerCase()))
          )
        }
        return rules
      })

      const stack = detectProjectStack("/project")
      expect(stack).toContain("typescript")

      const rulesDir = findRulesDir("/project")
      const loaded = loadLocalRules(rulesDir!)
      const filtered = filterRules(loaded, { stack: stack.join(",") })

      expect(filtered).toHaveLength(2)
      expect(filtered.map((r) => r.id)).toContain("ts-strict")
      expect(filtered.map((r) => r.id)).toContain("global-secrets")
      expect(filtered.map((r) => r.id)).not.toContain("java-di")
    })

    it("returns all rules when no stack detected", () => {
      mockDetectStack.mockReturnValue([])
      mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
      const rules = [
        makeRule({ id: "r1" }),
        makeRule({ id: "r2" }),
      ]
      mockLoadLocalRules.mockReturnValue(rules)
      mockFilterRules.mockReturnValue(rules)

      const stack = detectProjectStack("/project")
      expect(stack).toEqual([])

      const loaded = loadLocalRules("/project/.rulebound/rules")
      const filtered = filterRules(loaded, { task: "anything" })
      expect(filtered).toHaveLength(2)
    })
  })

  describe("validate_plan full flow", () => {
    it("loads rules, validates plan, returns structured report", () => {
      mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
      const rules = [
        makeRule({ id: "no-secrets", title: "No Secrets", modality: "must" }),
        makeRule({ id: "error-handling", title: "Error Handling", modality: "should" }),
      ]
      mockLoadLocalRules.mockReturnValue(rules)
      mockFilterRules.mockReturnValue(rules)
      mockValidatePlan.mockReturnValue(makeReport({
        status: "FAILED",
        rulesTotal: 2,
        results: [
          {
            ruleId: "no-secrets",
            ruleTitle: "No Secrets",
            severity: "error",
            modality: "must",
            status: "VIOLATED",
            reason: "Plan mentions hardcoded API key",
            suggestedFix: "Use environment variables",
          },
          {
            ruleId: "error-handling",
            ruleTitle: "Error Handling",
            severity: "warning",
            modality: "should",
            status: "PASS",
            reason: "Plan addresses error handling",
          },
        ],
        summary: { pass: 1, violated: 1, notCovered: 0 },
      }))

      const loaded = loadLocalRules("/project/.rulebound/rules")
      const relevant = filterRules(loaded, { task: "Add API integration" })
      const report = validatePlanAgainstRules(
        "I will hardcode the API key for quick testing",
        relevant,
        "Add API integration"
      )

      expect(report.status).toBe("FAILED")
      expect(report.summary.violated).toBe(1)
      expect(report.summary.pass).toBe(1)
      expect(report.results[0].suggestedFix).toBe("Use environment variables")
    })
  })

  describe("validate_before_write full flow", () => {
    it("combines AST and semantic validation for a file", async () => {
      mockDetectLangFromPath.mockReturnValue("typescript")
      mockIsSupportedLanguage.mockReturnValue(true)
      mockAnalyzeWithBuiltins.mockResolvedValue({
        language: "typescript",
        matches: [
          {
            queryId: "ts-no-any",
            queryName: "No Any Type",
            message: "Avoid 'any'",
            severity: "warning",
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
      mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
      mockLoadLocalRules.mockReturnValue([makeRule({ id: "no-secrets" })])
      mockFilterRules.mockReturnValue([makeRule({ id: "no-secrets" })])
      mockValidatePlan.mockReturnValue(makeReport({
        status: "FAILED",
        results: [
          {
            ruleId: "no-secrets",
            ruleTitle: "No Secrets",
            severity: "error",
            modality: "must",
            status: "VIOLATED",
            reason: "Hardcoded secret detected",
            suggestedFix: "Use env vars",
          },
        ],
      }))

      const filePath = "service.ts"
      const code = "const x: any = 'sk_live_abc';"

      const lang = detectLanguageFromPath(filePath)
      expect(lang).toBe("typescript")

      const astResult = await analyzeWithBuiltins(code, lang!)
      const astViolations = astResult.matches.map((m) => ({
        rule: m.queryId,
        line: m.location.startRow + 1,
        message: m.message,
        severity: m.severity,
        source: "ast" as const,
      }))

      const rules = loadLocalRules("/project/.rulebound/rules")
      const relevant = filterRules(rules, { stack: lang! })
      const report = validatePlanAgainstRules(code, relevant, `Writing ${filePath}`)
      const semanticViolations = report.results
        .filter((r) => r.status === "VIOLATED")
        .map((r) => ({
          rule: r.ruleId,
          message: r.reason,
          severity: r.severity,
          source: "semantic" as const,
        }))

      const allViolations = [...astViolations, ...semanticViolations]
      expect(allViolations).toHaveLength(2)
      expect(allViolations[0].source).toBe("ast")
      expect(allViolations[1].source).toBe("semantic")

      const approved = allViolations.length === 0
      expect(approved).toBe(false)
    })

    it("approves clean code with no violations", async () => {
      mockDetectLangFromPath.mockReturnValue("typescript")
      mockIsSupportedLanguage.mockReturnValue(true)
      mockAnalyzeWithBuiltins.mockResolvedValue({
        language: "typescript",
        matches: [],
        parseErrors: 0,
        nodeCount: 5,
        parseTimeMs: 1,
        queryTimeMs: 1,
      })
      mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
      mockLoadLocalRules.mockReturnValue([makeRule()])
      mockFilterRules.mockReturnValue([makeRule()])
      mockValidatePlan.mockReturnValue(makeReport({
        status: "PASSED",
        results: [
          { ruleId: "test-rule", ruleTitle: "Test Rule", severity: "error", modality: "must", status: "PASS", reason: "Clean" },
        ],
      }))

      const lang = detectLanguageFromPath("clean.ts")
      const astResult = await analyzeWithBuiltins("const x: number = 1;", lang!)
      const report = validatePlanAgainstRules("const x: number = 1;", [makeRule()])

      const violations = [
        ...astResult.matches,
        ...report.results.filter((r) => r.status === "VIOLATED"),
      ]
      expect(violations).toHaveLength(0)
    })
  })

  describe("check_code full flow", () => {
    it("runs AST analysis on supported language", async () => {
      mockDetectLangFromPath.mockReturnValue("python")
      mockIsSupportedLanguage.mockReturnValue(true)
      mockAnalyzeWithBuiltins.mockResolvedValue({
        language: "python",
        matches: [
          {
            queryId: "py-no-eval",
            queryName: "No eval()",
            message: "eval() is dangerous",
            severity: "error",
            location: { startRow: 0, startColumn: 0, endRow: 0, endColumn: 15 },
            matchedText: "eval('code')",
            capturedNodes: [],
          },
        ],
        parseErrors: 0,
        nodeCount: 3,
        parseTimeMs: 1,
        queryTimeMs: 1,
      })

      const lang = detectLanguageFromPath("script.py")
      expect(isSupportedLanguage(lang!)).toBe(true)

      const result = await analyzeWithBuiltins("eval('code')", lang!)
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].queryId).toBe("py-no-eval")
    })

    it("skips AST for unsupported file types", () => {
      mockDetectLangFromPath.mockReturnValue(null)
      mockIsSupportedLanguage.mockReturnValue(false)

      const lang = detectLanguageFromPath("data.csv")
      expect(lang).toBeNull()
    })
  })

  describe("list_rules full flow", () => {
    it("loads and lists rules with full metadata", () => {
      const rules = [
        makeRule({ id: "sec-1", title: "Auth Rule", category: "security", severity: "error", modality: "must", tags: ["auth", "jwt"] }),
        makeRule({ id: "style-1", title: "Code Style", category: "style", severity: "warning", modality: "should", tags: ["formatting"] }),
        makeRule({ id: "test-1", title: "Test Coverage", category: "testing", severity: "info", modality: "may", tags: ["coverage"] }),
      ]
      mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
      mockLoadLocalRules.mockReturnValue(rules)

      const loaded = loadLocalRules("/project/.rulebound/rules")
      const compact = loaded.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        severity: r.severity,
        modality: r.modality,
        tags: r.tags,
      }))

      expect(compact).toHaveLength(3)
      expect(compact[0].tags).toContain("auth")
      expect(compact[1].category).toBe("style")
      expect(compact[2].modality).toBe("may")
    })
  })
})
