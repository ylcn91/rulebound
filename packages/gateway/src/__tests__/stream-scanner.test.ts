import { describe, it, expect, vi, beforeEach } from "vitest"
import { StreamScanner } from "../interceptor/stream-scanner.js"
import type { Rule } from "@rulebound/engine"

vi.mock("@rulebound/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rulebound/engine")>()
  return {
    ...actual,
    validate: vi.fn(),
  }
})

vi.mock("../interceptor/post-response.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../interceptor/post-response.js")>()
  return {
    ...original,
    scanResponse: vi.fn(),
  }
})

import { scanResponse } from "../interceptor/post-response.js"

const mockScanResponse = vi.mocked(scanResponse)

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

describe("StreamScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScanResponse.mockResolvedValue({
      codeBlockCount: 1,
      hasViolations: false,
      violations: [],
      enforcement: {
        hasMustViolation: false,
        hasShouldViolation: false,
        score: 100,
        semanticScore: 100,
        astErrorCount: 0,
        astWarningCount: 0,
      },
    })
  })

  describe("appendChunk", () => {
    it("accumulates chunks correctly", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("Hello ")
      scanner.appendChunk("World")
      expect(scanner.getBuffer()).toBe("Hello World")
    })

    it("starts with empty buffer", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      expect(scanner.getBuffer()).toBe("")
    })

    it("handles empty string chunks", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("")
      scanner.appendChunk("data")
      scanner.appendChunk("")
      expect(scanner.getBuffer()).toBe("data")
    })
  })

  describe("hasCompleteCodeBlock", () => {
    it("returns false with no backticks", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("Just plain text")
      expect(scanner.hasCompleteCodeBlock()).toBe(false)
    })

    it("returns false with only opening fence (1 triple backtick)", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("```python\nprint('hi')\n")
      expect(scanner.hasCompleteCodeBlock()).toBe(false)
    })

    it("returns true with complete code block (2 fences)", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("```python\nprint('hi')\n```")
      expect(scanner.hasCompleteCodeBlock()).toBe(true)
    })

    it("returns true with multiple complete blocks", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("```js\nconst a = 1\n```\n```py\nx = 2\n```")
      expect(scanner.hasCompleteCodeBlock()).toBe(true)
    })

    it("returns false with odd number of fences (3 fences = 1 complete + 1 open)", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("```js\nconst a = 1\n```\n```py\nx = 2\n")
      expect(scanner.hasCompleteCodeBlock()).toBe(false)
    })

    it("detects complete block built from multiple chunks", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("Here is code:\n```python\n")
      expect(scanner.hasCompleteCodeBlock()).toBe(false)
      scanner.appendChunk("print('hello')\n```\n")
      expect(scanner.hasCompleteCodeBlock()).toBe(true)
    })
  })

  describe("scanAccumulated", () => {
    it("returns no violations when no rules provided", async () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("```js\nconst x = 1\n```")

      const result = await scanner.scanAccumulated()
      expect(result.action).toBe("pass")
      expect(result.warning).toBe("")
    })

    it("returns no violations when buffer has no code blocks", async () => {
      const rules = [makeRule()]
      const scanner = new StreamScanner({ rules, enforcement: "advisory" })
      scanner.appendChunk("Just text, no code")

      const result = await scanner.scanAccumulated()
      expect(result.action).toBe("none")
      expect(result.warning).toBe("")
    })

    it("calls scanResponse and reports violations", async () => {
      const rules = [makeRule()]
      mockScanResponse.mockResolvedValue({
        codeBlockCount: 1,
        hasViolations: true,
        violations: [
          {
            ruleId: "no-secrets",
            ruleTitle: "No Secrets",
            severity: "error",
            reason: "Found key",
            codeSnippet: "...",
            source: "semantic",
            modality: "must",
          },
        ],
        enforcement: {
          hasMustViolation: true,
          hasShouldViolation: false,
          score: 0,
          semanticScore: 0,
          astErrorCount: 0,
          astWarningCount: 0,
        },
      })

      const scanner = new StreamScanner({ rules, enforcement: "advisory" })
      scanner.appendChunk("```js\nconst key = 'secret'\n```")

      const result = await scanner.scanAccumulated()
      expect(result.action).toBe("warn")
      expect(result.warning).toContain("No Secrets")
    })

    it("triggers onViolation callback when violations found", async () => {
      const onViolation = vi.fn()
      const rules = [makeRule()]
      mockScanResponse.mockResolvedValue({
        codeBlockCount: 1,
        hasViolations: true,
        violations: [
          {
            ruleId: "bad-practice",
            ruleTitle: "Bad Practice",
            severity: "warning",
            reason: "Issue found",
            codeSnippet: "...",
            source: "semantic",
            modality: "should",
          },
        ],
        enforcement: {
          hasMustViolation: false,
          hasShouldViolation: true,
          score: 80,
          semanticScore: 80,
          astErrorCount: 0,
          astWarningCount: 0,
        },
      })

      const scanner = new StreamScanner({ rules, enforcement: "advisory", onViolation })
      scanner.appendChunk("```js\nconst x = 1\n```")

      await scanner.scanAccumulated()
      expect(onViolation).toHaveBeenCalledOnce()
      expect(onViolation).toHaveBeenCalledWith(expect.stringContaining("Bad Practice"))
    })

    it("does not trigger onViolation when no violations", async () => {
      const onViolation = vi.fn()
      const rules = [makeRule()]
      mockScanResponse.mockResolvedValue({
        codeBlockCount: 1,
        hasViolations: false,
        violations: [],
        enforcement: {
          hasMustViolation: false,
          hasShouldViolation: false,
          score: 100,
          semanticScore: 100,
          astErrorCount: 0,
          astWarningCount: 0,
        },
      })

      const scanner = new StreamScanner({ rules, enforcement: "advisory", onViolation })
      scanner.appendChunk("```js\nconst x = 1\n```")

      await scanner.scanAccumulated()
      expect(onViolation).not.toHaveBeenCalled()
    })
  })

  describe("reset", () => {
    it("clears the buffer", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("some data in the buffer")
      expect(scanner.getBuffer()).not.toBe("")

      scanner.reset()
      expect(scanner.getBuffer()).toBe("")
    })

    it("allows re-accumulation after reset", () => {
      const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
      scanner.appendChunk("old data")
      scanner.reset()
      scanner.appendChunk("new data")
      expect(scanner.getBuffer()).toBe("new data")
    })
  })
})
