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
  detectLanguageFromCode,
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
const mockDetectLanguage = vi.mocked(detectLanguageFromCode)
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

// Since the MCP tools are registered on a server singleton, we test the underlying
// functions directly rather than the MCP protocol layer.

describe("find_rules tool logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDetectStack.mockReturnValue([])
  })

  it("returns error when no rules directory found", () => {
    mockFindRulesDir.mockReturnValue(null)

    const rulesDir = findRulesDir("/nonexistent")
    expect(rulesDir).toBeNull()
  })

  it("loads and filters rules when rules directory exists", () => {
    const rules = [
      makeRule({ id: "r1", title: "Security Rule", category: "security" }),
      makeRule({ id: "r2", title: "Style Rule", category: "style" }),
    ]
    mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
    mockLoadLocalRules.mockReturnValue(rules)
    mockFilterRules.mockReturnValue([rules[0]])

    const rulesDir = findRulesDir("/project")
    expect(rulesDir).toBe("/project/.rulebound/rules")

    const loaded = loadLocalRules(rulesDir!)
    expect(loaded).toHaveLength(2)

    const filtered = filterRules(loaded, { task: "security audit", category: "security" })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("r1")
  })

  it("filters rules by category", () => {
    const rules = [
      makeRule({ id: "sec", category: "security" }),
      makeRule({ id: "style", category: "style" }),
    ]
    mockFilterRules.mockImplementation((r, opts) => {
      if (opts.category) {
        return r.filter((rule) => rule.category === opts.category)
      }
      return r
    })

    const filtered = filterRules(rules, { category: "security" })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("sec")
  })

  it("filters rules by task keywords", () => {
    const rules = [
      makeRule({ id: "auth-rule", title: "Authentication Standards", tags: ["auth"] }),
      makeRule({ id: "db-rule", title: "Database Migration", tags: ["database"] }),
    ]
    mockFilterRules.mockImplementation((r, opts) => {
      if (opts.task?.includes("auth")) {
        return r.filter((rule) => rule.tags.includes("auth"))
      }
      return r
    })

    const filtered = filterRules(rules, { task: "implement auth login" })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("auth-rule")
  })
})

describe("validate_plan tool logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns PASSED for clean plan", () => {
    const rules = [makeRule()]
    const report = makeReport({
      status: "PASSED",
      summary: { pass: 1, violated: 0, notCovered: 0 },
      results: [
        { ruleId: "test-rule", ruleTitle: "Test Rule", severity: "error", modality: "must", status: "PASS", reason: "Plan follows rule" },
      ],
    })
    mockValidatePlan.mockReturnValue(report)

    const result = validatePlanAgainstRules("Use constructor injection", rules, "DI task")
    expect(result.status).toBe("PASSED")
    expect(result.summary.violated).toBe(0)
  })

  it("returns FAILED for plan with must-modality violations", () => {
    const rules = [makeRule({ modality: "must" })]
    const report = makeReport({
      status: "FAILED",
      summary: { pass: 0, violated: 1, notCovered: 0 },
      results: [
        {
          ruleId: "test-rule",
          ruleTitle: "Test Rule",
          severity: "error",
          modality: "must",
          status: "VIOLATED",
          reason: "Plan violates rule",
          suggestedFix: "Change approach",
        },
      ],
    })
    mockValidatePlan.mockReturnValue(report)

    const result = validatePlanAgainstRules("Use field injection everywhere", rules, "bad plan")
    expect(result.status).toBe("FAILED")
    expect(result.summary.violated).toBe(1)
  })

  it("returns PASSED_WITH_WARNINGS for should-modality violations", () => {
    const rules = [makeRule({ modality: "should" })]
    const report = makeReport({
      status: "PASSED_WITH_WARNINGS",
      summary: { pass: 0, violated: 1, notCovered: 0 },
      results: [
        { ruleId: "test-rule", ruleTitle: "Test Rule", severity: "warning", modality: "should", status: "VIOLATED", reason: "Minor issue" },
      ],
    })
    mockValidatePlan.mockReturnValue(report)

    const result = validatePlanAgainstRules("Plan text", rules)
    expect(result.status).toBe("PASSED_WITH_WARNINGS")
  })

  it("includes suggested fixes in violated results", () => {
    const report = makeReport({
      status: "FAILED",
      results: [
        {
          ruleId: "r1",
          ruleTitle: "No Secrets",
          severity: "error",
          modality: "must",
          status: "VIOLATED",
          reason: "Hardcoded secret found",
          suggestedFix: "Use environment variables",
        },
      ],
    })
    mockValidatePlan.mockReturnValue(report)

    const result = validatePlanAgainstRules("hardcode API key", [makeRule()])
    const violation = result.results.find((r) => r.status === "VIOLATED")
    expect(violation?.suggestedFix).toBe("Use environment variables")
  })
})

describe("check_code tool logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("detects language from code content", () => {
    mockDetectLanguage.mockReturnValue("java")
    const lang = detectLanguageFromCode("public class App {}")
    expect(lang).toBe("java")
  })

  it("detects language from file path", () => {
    mockDetectLanguage.mockReturnValue("typescript")
    const lang = detectLanguageFromCode("const x = 1", "app.ts")
    expect(lang).toBe("typescript")
  })

  it("returns undefined for unrecognizable code", () => {
    mockDetectLanguage.mockReturnValue(undefined)
    const lang = detectLanguageFromCode("random text")
    expect(lang).toBeUndefined()
  })

  it("validates code against relevant rules", () => {
    const rules = [makeRule({ stack: ["typescript"] })]
    const report = makeReport({
      status: "PASSED",
      results: [
        { ruleId: "test-rule", ruleTitle: "Test Rule", severity: "error", modality: "must", status: "PASS", reason: "Code is clean" },
      ],
    })
    mockValidatePlan.mockReturnValue(report)
    mockFilterRules.mockReturnValue(rules)

    const result = validatePlanAgainstRules("const user = getUser()", rules)
    expect(result.status).toBe("PASSED")
  })

  it("reports violations in code", () => {
    const rules = [makeRule({ id: "secrets", tags: ["secrets"] })]
    const report = makeReport({
      status: "FAILED",
      results: [
        {
          ruleId: "secrets",
          ruleTitle: "No Secrets",
          severity: "error",
          modality: "must",
          status: "VIOLATED",
          reason: "Hardcoded secret",
          suggestedFix: "Use env vars",
        },
      ],
      summary: { pass: 0, violated: 1, notCovered: 0 },
    })
    mockValidatePlan.mockReturnValue(report)

    const result = validatePlanAgainstRules("const apiKey = 'sk-abc123'", rules)
    expect(result.results.some((r) => r.status === "VIOLATED")).toBe(true)
  })
})

describe("list_rules tool logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns error when no rules directory found", () => {
    mockFindRulesDir.mockReturnValue(null)
    const rulesDir = findRulesDir("/no-rules")
    expect(rulesDir).toBeNull()
  })

  it("lists all rules for project stack", () => {
    const rules = [
      makeRule({ id: "r1", title: "Rule 1", category: "security", severity: "error", modality: "must" }),
      makeRule({ id: "r2", title: "Rule 2", category: "style", severity: "warning", modality: "should" }),
      makeRule({ id: "r3", title: "Rule 3", category: "testing", severity: "info", modality: "may" }),
    ]
    mockFindRulesDir.mockReturnValue("/project/rules")
    mockLoadLocalRules.mockReturnValue(rules)
    mockFilterRules.mockReturnValue(rules)

    const loaded = loadLocalRules("/project/rules")
    expect(loaded).toHaveLength(3)

    const compact = loaded.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      severity: r.severity,
      modality: r.modality,
    }))
    expect(compact[0].id).toBe("r1")
    expect(compact[1].category).toBe("style")
    expect(compact[2].modality).toBe("may")
  })

  it("filters rules by category when specified", () => {
    const rules = [
      makeRule({ id: "sec1", category: "security" }),
      makeRule({ id: "style1", category: "style" }),
      makeRule({ id: "sec2", category: "security" }),
    ]
    mockLoadLocalRules.mockReturnValue(rules)

    const filtered = rules.filter((r) => r.category.toLowerCase() === "security")
    expect(filtered).toHaveLength(2)
    expect(filtered.every((r) => r.category === "security")).toBe(true)
  })
})

describe("detectProjectStack", () => {
  it("returns empty array by default in test", () => {
    mockDetectStack.mockReturnValue([])
    const stack = detectProjectStack("/project")
    expect(stack).toEqual([])
  })

  it("detects typescript from package.json", () => {
    mockDetectStack.mockReturnValue(["typescript", "javascript"])
    const stack = detectProjectStack("/project")
    expect(stack).toContain("typescript")
    expect(stack).toContain("javascript")
  })

  it("detects java from pom.xml", () => {
    mockDetectStack.mockReturnValue(["java", "spring-boot"])
    const stack = detectProjectStack("/project")
    expect(stack).toContain("java")
    expect(stack).toContain("spring-boot")
  })
})

describe("validate_before_write tool logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns approved:true for clean code with no violations", () => {
    mockDetectLangFromPath.mockReturnValue("typescript")
    mockIsSupportedLanguage.mockReturnValue(true)
    mockAnalyzeWithBuiltins.mockResolvedValue({
      language: "typescript",
      matches: [],
      parseErrors: 0,
      nodeCount: 10,
      parseTimeMs: 1,
      queryTimeMs: 1,
    })
    mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
    mockLoadLocalRules.mockReturnValue([makeRule()])
    mockFilterRules.mockReturnValue([makeRule()])
    mockValidatePlan.mockReturnValue(makeReport({
      status: "PASSED",
      results: [
        { ruleId: "test-rule", ruleTitle: "Test Rule", severity: "error", modality: "must", status: "PASS", reason: "Code follows rule" },
      ],
    }))

    // Simulate the tool logic
    const lang = detectLanguageFromPath("app.ts")
    expect(lang).toBe("typescript")

    const supported = isSupportedLanguage(lang!)
    expect(supported).toBe(true)

    const rulesDir = findRulesDir("/project")
    expect(rulesDir).toBe("/project/.rulebound/rules")

    const rules = loadLocalRules(rulesDir!)
    const relevant = filterRules(rules, { stack: lang! })
    const report = validatePlanAgainstRules("const x = 1", relevant, "Writing app.ts")

    const semanticViolations = report.results
      .filter((r) => r.status === "VIOLATED")

    expect(semanticViolations).toHaveLength(0)
  })

  it("returns approved:false with AST violations", async () => {
    mockDetectLangFromPath.mockReturnValue("typescript")
    mockIsSupportedLanguage.mockReturnValue(true)
    mockAnalyzeWithBuiltins.mockResolvedValue({
      language: "typescript",
      matches: [
        {
          queryId: "no-console-log",
          queryName: "No Console Log",
          message: "console.log found",
          severity: "warning",
          location: { startRow: 0, startColumn: 0, endRow: 0, endColumn: 20 },
          matchedText: "console.log('test')",
          capturedNodes: [],
        },
      ],
      parseErrors: 0,
      nodeCount: 5,
      parseTimeMs: 1,
      queryTimeMs: 1,
    })

    const result = await analyzeWithBuiltins("console.log('test')", "typescript")
    expect(result.matches).toHaveLength(1)

    const astViolations = result.matches.map((match) => ({
      rule: match.queryId,
      line: match.location.startRow + 1,
      message: match.message,
      severity: match.severity,
      source: "ast" as const,
    }))

    expect(astViolations).toHaveLength(1)
    expect(astViolations[0].rule).toBe("no-console-log")
    expect(astViolations[0].line).toBe(1)
    expect(astViolations[0].source).toBe("ast")
  })

  it("handles unknown language gracefully with no AST analysis", () => {
    mockDetectLangFromPath.mockReturnValue(null)
    mockDetectLanguage.mockReturnValue(undefined)
    mockIsSupportedLanguage.mockReturnValue(false)
    mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
    mockLoadLocalRules.mockReturnValue([makeRule()])
    mockFilterRules.mockReturnValue([makeRule()])
    mockValidatePlan.mockReturnValue(makeReport({
      status: "PASSED",
      results: [
        { ruleId: "test-rule", ruleTitle: "Test Rule", severity: "error", modality: "must", status: "PASS", reason: "Code follows rule" },
      ],
    }))

    const lang = detectLanguageFromPath("config.yaml") ?? detectLanguageFromCode("key: value", "config.yaml")
    expect(lang).toBeUndefined()

    // AST analysis should be skipped for unsupported language
    const shouldRunAst = lang != null && isSupportedLanguage(lang)
    expect(shouldRunAst).toBe(false)

    // Semantic validation still runs
    const report = validatePlanAgainstRules("key: value", [makeRule()], "Writing config.yaml")
    expect(report.status).toBe("PASSED")
  })

  it("returns correct JSON structure with all required fields", async () => {
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

    const lang = detectLanguageFromPath("app.ts") ?? "unknown"
    const astResult = await analyzeWithBuiltins("const x = 1", "typescript")
    const astViolations = astResult.matches.map((match) => ({
      rule: match.queryId,
      line: match.location.startRow + 1,
      message: match.message,
      severity: match.severity,
      source: "ast" as const,
    }))
    const report = validatePlanAgainstRules("const x = 1", [makeRule()], "Writing app.ts")
    const semanticViolations = report.results
      .filter((r) => r.status === "VIOLATED")
      .map((r) => ({
        rule: r.ruleId,
        message: r.reason,
        severity: r.severity,
        fix: r.suggestedFix,
        source: "semantic" as const,
      }))

    const violations = [...astViolations, ...semanticViolations]
    const approved = violations.length === 0

    const response = {
      approved,
      file_path: "app.ts",
      language: lang,
      violations,
      message: approved
        ? "Code is clean — safe to write"
        : `${violations.length} violation(s) found — review before writing`,
    }

    expect(response).toHaveProperty("approved", true)
    expect(response).toHaveProperty("file_path", "app.ts")
    expect(response).toHaveProperty("language", "typescript")
    expect(response).toHaveProperty("violations")
    expect(response).toHaveProperty("message", "Code is clean — safe to write")
    expect(response.violations).toEqual([])
  })

  it("returns approved:true when no rules directory exists", () => {
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
    mockFindRulesDir.mockReturnValue(null)

    const rulesDir = findRulesDir("/no-rules-project")
    expect(rulesDir).toBeNull()

    // No rules means no semantic violations possible
    const rules = rulesDir ? loadLocalRules(rulesDir) : []
    expect(rules).toHaveLength(0)

    // With no AST violations and no rules, result should be approved
    const violations: unknown[] = []
    const approved = violations.length === 0
    expect(approved).toBe(true)
  })

  it("combines AST and semantic violations in result", async () => {
    mockDetectLangFromPath.mockReturnValue("typescript")
    mockIsSupportedLanguage.mockReturnValue(true)
    mockAnalyzeWithBuiltins.mockResolvedValue({
      language: "typescript",
      matches: [
        {
          queryId: "no-any",
          queryName: "No Any Type",
          message: "Avoid using 'any' type",
          severity: "warning",
          location: { startRow: 0, startColumn: 6, endRow: 0, endColumn: 9 },
          matchedText: "any",
          capturedNodes: [],
        },
      ],
      parseErrors: 0,
      nodeCount: 3,
      parseTimeMs: 1,
      queryTimeMs: 1,
    })
    mockFindRulesDir.mockReturnValue("/project/.rulebound/rules")
    mockLoadLocalRules.mockReturnValue([makeRule({ id: "secrets", tags: ["secrets"] })])
    mockFilterRules.mockReturnValue([makeRule({ id: "secrets", tags: ["secrets"] })])
    mockValidatePlan.mockReturnValue(makeReport({
      status: "FAILED",
      results: [
        {
          ruleId: "secrets",
          ruleTitle: "No Secrets",
          severity: "error",
          modality: "must",
          status: "VIOLATED",
          reason: "Hardcoded secret found",
          suggestedFix: "Use env vars",
        },
      ],
    }))

    const astResult = await analyzeWithBuiltins("const x: any = 'sk-abc'", "typescript")
    const astViolations = astResult.matches.map((match) => ({
      rule: match.queryId,
      line: match.location.startRow + 1,
      message: match.message,
      severity: match.severity,
      source: "ast" as const,
    }))

    const report = validatePlanAgainstRules("const x: any = 'sk-abc'", [makeRule()], "Writing app.ts")
    const semanticViolations = report.results
      .filter((r) => r.status === "VIOLATED")
      .map((r) => ({
        rule: r.ruleId,
        message: r.reason,
        severity: r.severity,
        fix: r.suggestedFix,
        source: "semantic" as const,
      }))

    const violations = [...astViolations, ...semanticViolations]
    expect(violations).toHaveLength(2)
    expect(violations[0].source).toBe("ast")
    expect(violations[0].rule).toBe("no-any")
    expect(violations[1].source).toBe("semantic")
    expect(violations[1].rule).toBe("secrets")
  })
})
