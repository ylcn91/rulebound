import { describe, it, expect, vi } from "vitest"
import { buildRuleInjectionText, injectRulesOpenAI, injectRulesAnthropic } from "../interceptor/pre-request.js"
import { extractCodeBlocks, scanResponse, buildViolationWarning } from "../interceptor/post-response.js"
import { StreamScanner } from "../interceptor/stream-scanner.js"
import type { Rule } from "@rulebound/engine"

vi.mock("../interceptor/ast-scanner.js", () => ({
  scanCodeBlockWithAST: vi.fn().mockResolvedValue([]),
  detectLanguageFromAnnotation: vi.fn().mockReturnValue(null),
}))

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

describe("pre-request", () => {
  it("builds rule injection text", () => {
    const rules = [
      makeRule({ title: "No Hardcoded Secrets", severity: "error" }),
      makeRule({ title: "Use Constructor Injection", severity: "warning" }),
    ]
    const text = buildRuleInjectionText(rules)
    expect(text).toContain("<rulebound_rules>")
    expect(text).toContain("[MUST] No Hardcoded Secrets")
    expect(text).toContain("[SHOULD] Use Constructor Injection")
    expect(text).toContain("</rulebound_rules>")
  })

  it("returns empty string for no rules", () => {
    expect(buildRuleInjectionText([])).toBe("")
  })

  it("injects into OpenAI format - existing system message", () => {
    const body = {
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Write code" },
      ],
    }
    const result = injectRulesOpenAI(body, "RULES HERE")
    expect(result.messages![0].content).toContain("You are a helpful assistant")
    expect(result.messages![0].content).toContain("RULES HERE")
  })

  it("injects into OpenAI format - no system message", () => {
    const body = { messages: [{ role: "user", content: "Write code" }] }
    const result = injectRulesOpenAI(body, "RULES HERE")
    expect(result.messages![0].role).toBe("system")
    expect(result.messages![0].content).toBe("RULES HERE")
    expect(result.messages!).toHaveLength(2)
  })

  it("injects into Anthropic format - string system", () => {
    const body = { system: "Be concise", messages: [{ role: "user", content: "Hi" }] }
    const result = injectRulesAnthropic(body, "RULES")
    expect(result.system).toContain("Be concise")
    expect(result.system).toContain("RULES")
  })

  it("injects into Anthropic format - no system", () => {
    const body = { messages: [{ role: "user", content: "Hi" }] }
    const result = injectRulesAnthropic(body, "RULES")
    expect(result.system).toBe("RULES")
  })
})

describe("post-response", () => {
  it("extracts code blocks with language annotations", () => {
    const text = "Here is code:\n```python\ndef hello():\n  pass\n```\nAnd more:\n```go\nfunc main() {}\n```"
    const blocks = extractCodeBlocks(text)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].code).toContain("def hello()")
    expect(blocks[0].language).toBe("python")
    expect(blocks[1].code).toContain("func main()")
    expect(blocks[1].language).toBe("go")
  })

  it("returns null language for unannotated code blocks", () => {
    const text = "Code:\n```\nsome code\n```"
    const blocks = extractCodeBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].code).toBe("some code")
    expect(blocks[0].language).toBeNull()
  })

  it("returns empty for no code blocks", () => {
    expect(extractCodeBlocks("Just text, no code")).toEqual([])
  })

  it("builds violation warning text", () => {
    const violations = [
      { ruleTitle: "No Secrets", severity: "error", reason: "Found hardcoded secret", codeSnippet: "..." },
    ]
    const warning = buildViolationWarning(violations)
    expect(warning).toContain("[ERROR]")
    expect(warning).toContain("No Secrets")
    expect(warning).toContain("Found hardcoded secret")
  })

  it("returns empty warning for no violations", () => {
    expect(buildViolationWarning([])).toBe("")
  })
})

describe("StreamScanner", () => {
  it("detects complete code blocks", () => {
    const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
    scanner.appendChunk("Hello\n```python\n")
    expect(scanner.hasCompleteCodeBlock()).toBe(false)
    scanner.appendChunk("print('hi')\n```\n")
    expect(scanner.hasCompleteCodeBlock()).toBe(true)
  })

  it("accumulates buffer", () => {
    const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
    scanner.appendChunk("chunk1")
    scanner.appendChunk("chunk2")
    expect(scanner.getBuffer()).toBe("chunk1chunk2")
  })

  it("resets buffer", () => {
    const scanner = new StreamScanner({ rules: [], enforcement: "advisory" })
    scanner.appendChunk("data")
    scanner.reset()
    expect(scanner.getBuffer()).toBe("")
  })
})
