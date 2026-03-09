import { describe, it, expect, vi, beforeEach } from "vitest"
import { extractCodeBlocks, scanResponse, buildViolationWarning } from "../interceptor/post-response.js"
import type { Rule } from "@rulebound/engine"

vi.mock("@rulebound/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rulebound/engine")>()
  return {
    ...actual,
    validate: vi.fn(),
  }
})

vi.mock("../interceptor/ast-scanner.js", () => ({
  scanCodeBlockWithAST: vi.fn().mockResolvedValue([]),
  detectLanguageFromAnnotation: vi.fn().mockReturnValue(null),
}))

import { validate } from "@rulebound/engine"

const mockValidate = vi.mocked(validate)

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "test-rule",
    title: "Test Rule",
    content: "- Must follow this rule",
    category: "security",
    severity: "error",
    modality: "must",
    tags: [],
    stack: [],
    scope: [],
    changeTypes: [],
    team: [],
    filePath: "",
    ...overrides,
  }
}

describe("extractCodeBlocks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns empty array when no code blocks exist", () => {
    expect(extractCodeBlocks("Just plain text without any code")).toEqual([])
  })

  it("extracts a single code block", () => {
    const text = "Here is code:\n```python\ndef hello():\n  return 'hi'\n```"
    const blocks = extractCodeBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].code).toContain("def hello()")
    expect(blocks[0].language).toBe("python")
  })

  it("extracts multiple code blocks", () => {
    const text = [
      "First block:",
      "```javascript",
      "const x = 1",
      "```",
      "Second block:",
      "```python",
      "y = 2",
      "```",
    ].join("\n")
    const blocks = extractCodeBlocks(text)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].code).toContain("const x = 1")
    expect(blocks[0].language).toBe("javascript")
    expect(blocks[1].code).toContain("y = 2")
    expect(blocks[1].language).toBe("python")
  })

  it("handles code blocks with no language specified", () => {
    const text = "```\nsome code\n```"
    const blocks = extractCodeBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].code).toBe("some code")
    expect(blocks[0].language).toBeNull()
  })

  it("trims whitespace from extracted blocks", () => {
    const text = "```js\n  \n  const x = 1\n  \n```"
    const blocks = extractCodeBlocks(text)
    expect(blocks[0].code).toBe("const x = 1")
    expect(blocks[0].language).toBe("js")
  })

  it("handles text with only backticks but no complete block", () => {
    const text = "Use ``` for inline code"
    const blocks = extractCodeBlocks(text)
    expect(blocks).toEqual([])
  })
})

describe("scanResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns no violations when no rules are provided", async () => {
    const result = await scanResponse("```js\nconst x = 1\n```", [])
    expect(result.hasViolations).toBe(false)
    expect(result.violations).toEqual([])
    expect(result.enforcement.score).toBe(100)
  })

  it("returns no violations when no code blocks exist", async () => {
    const result = await scanResponse("Just text, no code", [makeRule()])
    expect(result.hasViolations).toBe(false)
    expect(result.violations).toEqual([])
    expect(result.codeBlockCount).toBe(0)
  })

  it("detects violations in code blocks", async () => {
    const mockReport = {
      task: "test",
      rulesMatched: 1,
      rulesTotal: 1,
      results: [
        {
          ruleId: "r1",
          ruleTitle: "No Secrets",
          severity: "error",
          modality: "must",
          status: "VIOLATED",
          reason: "Found hardcoded secret",
          suggestedFix: "Use env vars",
        },
      ],
      summary: { pass: 0, violated: 1, notCovered: 0 },
      status: "FAILED",
    }
    mockValidate.mockResolvedValue(mockReport as never)

    const result = await scanResponse(
      "Here:\n```js\nconst key = 'sk-abc123'\n```",
      [makeRule({ id: "r1", title: "No Secrets" })]
    )

    expect(result.hasViolations).toBe(true)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].ruleTitle).toBe("No Secrets")
    expect(result.violations[0].reason).toBe("Found hardcoded secret")
    expect(result.violations[0].suggestedFix).toBe("Use env vars")
    expect(result.violations[0].source).toBe("semantic")
    expect(result.violations[0].modality).toBe("must")
    expect(result.report).toBeDefined()
    expect(result.enforcement.hasMustViolation).toBe(true)
  })

  it("returns clean result when no violations found", async () => {
    const mockReport = {
      task: "test",
      rulesMatched: 1,
      rulesTotal: 1,
      results: [
        {
          ruleId: "r1",
          ruleTitle: "Code Quality",
          severity: "warning",
          modality: "should",
          status: "PASS",
          reason: "Code follows standards",
        },
      ],
      summary: { pass: 1, violated: 0, notCovered: 0 },
      status: "PASSED",
    }
    mockValidate.mockResolvedValue(mockReport as never)

    const result = await scanResponse(
      "```ts\nconst user = getUser()\n```",
      [makeRule()]
    )

    expect(result.hasViolations).toBe(false)
    expect(result.violations).toHaveLength(0)
    expect(result.enforcement.score).toBe(100)
  })

  it("includes code snippet in violation output", async () => {
    const codeContent = "const apiKey = 'hardcoded-secret-value'"
    const mockReport = {
      task: "test",
      rulesMatched: 1,
      rulesTotal: 1,
      results: [
        {
          ruleId: "r1",
          ruleTitle: "No Secrets",
          severity: "error",
          modality: "must",
          status: "VIOLATED",
          reason: "Hardcoded secret",
        },
      ],
      summary: { pass: 0, violated: 1, notCovered: 0 },
      status: "FAILED",
    }
    mockValidate.mockResolvedValue(mockReport as never)

    const result = await scanResponse(
      `\`\`\`js\n${codeContent}\n\`\`\``,
      [makeRule()]
    )

    expect(result.violations[0].codeSnippet).toBeDefined()
    expect(result.violations[0].codeSnippet.length).toBeGreaterThan(0)
  })
})

describe("buildViolationWarning", () => {
  it("returns empty string for no violations", () => {
    expect(buildViolationWarning([])).toBe("")
  })

  it("builds warning with ERROR icon for error severity", () => {
    const violations = [
      { ruleTitle: "No Secrets", severity: "error", reason: "Found API key", codeSnippet: "..." },
    ]
    const warning = buildViolationWarning(violations)
    expect(warning).toContain("[ERROR]")
    expect(warning).toContain("No Secrets")
    expect(warning).toContain("Found API key")
    expect(warning).toContain("Rulebound")
  })

  it("builds warning with WARNING icon for non-error severity", () => {
    const violations = [
      { ruleTitle: "Style Guide", severity: "warning", reason: "Use camelCase", codeSnippet: "..." },
    ]
    const warning = buildViolationWarning(violations)
    expect(warning).toContain("[WARNING]")
    expect(warning).toContain("Style Guide")
  })

  it("includes suggested fix when present", () => {
    const violations = [
      { ruleTitle: "Rule A", severity: "error", reason: "Bad practice", suggestedFix: "Use pattern B instead", codeSnippet: "..." },
    ]
    const warning = buildViolationWarning(violations)
    expect(warning).toContain("Fix: Use pattern B instead")
  })

  it("handles multiple violations", () => {
    const violations = [
      { ruleTitle: "Rule A", severity: "error", reason: "Issue A", codeSnippet: "..." },
      { ruleTitle: "Rule B", severity: "warning", reason: "Issue B", codeSnippet: "..." },
      { ruleTitle: "Rule C", severity: "error", reason: "Issue C", suggestedFix: "Fix C", codeSnippet: "..." },
    ]
    const warning = buildViolationWarning(violations)
    expect(warning).toContain("Rule A")
    expect(warning).toContain("Rule B")
    expect(warning).toContain("Rule C")
    expect(warning).toContain("Fix: Fix C")
    expect(warning).toContain("review and fix")
  })
})
