import { describe, it, expect } from "vitest"
import {
  getBuiltinQueries,
  getQueryById,
  getQueryIdsByCategory,
  listQueryIds,
  TS_QUERIES,
  JS_QUERIES,
  PYTHON_QUERIES,
  JAVA_QUERIES,
  GO_QUERIES,
  RUST_QUERIES,
} from "../ast/builtin-queries.js"
import { isSupportedLanguage, detectLanguageFromPath } from "../ast/parser-manager.js"
import { LANGUAGE_WASM_MAP, FILE_EXTENSION_MAP } from "../ast/types.js"
import { analyzeCode, analyzeWithBuiltins } from "../ast/analyzer.js"
import { ASTMatcher } from "../ast/matcher.js"
import type { Rule } from "../types.js"

describe("builtin-queries", () => {
  it("has at least 25 total queries", () => {
    const all = getBuiltinQueries()
    expect(all.length).toBeGreaterThanOrEqual(25)
  })

  it("returns language-specific queries", () => {
    const tsQueries = getBuiltinQueries("typescript")
    expect(tsQueries.length).toBeGreaterThan(0)
    expect(tsQueries.every((q) => q.language === "typescript" || q.language === "*")).toBe(true)

    const pyQueries = getBuiltinQueries("python")
    expect(pyQueries.length).toBeGreaterThan(0)
    expect(pyQueries.every((q) => q.language === "python" || q.language === "*")).toBe(true)
  })

  it("can look up query by ID", () => {
    const q = getQueryById("ts-no-any")
    expect(q).toBeDefined()
    expect(q!.name).toBe("No 'any' Type")
    expect(q!.language).toBe("typescript")
  })

  it("returns undefined for unknown query ID", () => {
    expect(getQueryById("nonexistent")).toBeUndefined()
  })

  it("filters by category", () => {
    const securityIds = getQueryIdsByCategory("security")
    expect(securityIds.length).toBeGreaterThan(0)
    for (const id of securityIds) {
      const q = getQueryById(id)
      expect(q?.category).toBe("security")
    }
  })

  it("lists query IDs for each language", () => {
    expect(listQueryIds("typescript").length).toBe(TS_QUERIES.length)
    expect(listQueryIds("python").length).toBe(PYTHON_QUERIES.length)
    expect(listQueryIds("java").length).toBe(JAVA_QUERIES.length)
    expect(listQueryIds("go").length).toBe(GO_QUERIES.length)
    expect(listQueryIds("rust").length).toBe(RUST_QUERIES.length)
  })

  it("JS queries are a subset of TS queries without TS-specific ones", () => {
    expect(JS_QUERIES.length).toBeLessThan(TS_QUERIES.length)
    expect(JS_QUERIES.every((q) => q.language === "javascript")).toBe(true)
  })

  it("all queries have required fields", () => {
    const all = getBuiltinQueries()
    for (const q of all) {
      expect(q.id).toBeTruthy()
      expect(q.name).toBeTruthy()
      expect(q.query).toBeTruthy()
      expect(q.message).toBeTruthy()
      expect(["error", "warning", "info"]).toContain(q.severity)
    }
  })
})

describe("parser-manager", () => {
  it("detects language from file path", () => {
    expect(detectLanguageFromPath("app.ts")).toBe("typescript")
    expect(detectLanguageFromPath("app.tsx")).toBe("typescript")
    expect(detectLanguageFromPath("script.py")).toBe("python")
    expect(detectLanguageFromPath("Main.java")).toBe("java")
    expect(detectLanguageFromPath("main.go")).toBe("go")
    expect(detectLanguageFromPath("lib.rs")).toBe("rust")
    expect(detectLanguageFromPath("app.js")).toBe("javascript")
    expect(detectLanguageFromPath("file.unknown")).toBeNull()
  })

  it("validates supported languages", () => {
    expect(isSupportedLanguage("typescript")).toBe(true)
    expect(isSupportedLanguage("python")).toBe(true)
    expect(isSupportedLanguage("java")).toBe(true)
    expect(isSupportedLanguage("go")).toBe(true)
    expect(isSupportedLanguage("rust")).toBe(true)
    expect(isSupportedLanguage("swift")).toBe(false)
    expect(isSupportedLanguage("")).toBe(false)
  })
})

describe("types", () => {
  it("has WASM mappings for all supported languages", () => {
    const languages = Object.keys(LANGUAGE_WASM_MAP)
    expect(languages.length).toBeGreaterThanOrEqual(10)
    for (const wasm of Object.values(LANGUAGE_WASM_MAP)) {
      expect(wasm).toMatch(/^tree-sitter-\w+\.wasm$/)
    }
  })

  it("has file extension mappings", () => {
    expect(FILE_EXTENSION_MAP[".ts"]).toBe("typescript")
    expect(FILE_EXTENSION_MAP[".py"]).toBe("python")
    expect(FILE_EXTENSION_MAP[".go"]).toBe("go")
  })
})

describe("analyzer (requires WASM)", () => {
  it("detects 'any' type in TypeScript", async () => {
    const code = `const x: any = 5;`
    const result = await analyzeCode(code, "typescript", [getQueryById("ts-no-any")!])
    expect(result.matches.length).toBe(1)
    expect(result.matches[0].queryId).toBe("ts-no-any")
    expect(result.language).toBe("typescript")
    expect(result.nodeCount).toBeGreaterThan(0)
  })

  it("detects eval in TypeScript", async () => {
    const code = `eval("code")`
    const result = await analyzeCode(code, "typescript", [getQueryById("ts-no-eval")!])
    expect(result.matches.length).toBe(1)
    expect(result.matches[0].queryId).toBe("ts-no-eval")
  })

  it("detects console.log in TypeScript", async () => {
    const code = `console.log("test")`
    const result = await analyzeCode(code, "typescript", [getQueryById("ts-no-console-log")!])
    expect(result.matches.length).toBe(1)
    expect(result.matches[0].queryId).toBe("ts-no-console-log")
    expect(result.matches[0].location.startRow).toBe(0)
  })

  it("detects debugger statement", async () => {
    const code = `function test() { debugger; }`
    const result = await analyzeCode(code, "typescript", [getQueryById("ts-no-debugger")!])
    expect(result.matches.length).toBe(1)
  })

  it("returns no matches for clean code", async () => {
    const code = `const x: string = "hello";`
    const result = await analyzeCode(code, "typescript", [getQueryById("ts-no-any")!])
    expect(result.matches.length).toBe(0)
  })

  it("detects var declaration", async () => {
    const code = `var x = 5;`
    const result = await analyzeCode(code, "typescript", [getQueryById("ts-no-var")!])
    expect(result.matches.length).toBe(1)
    expect(result.matches[0].queryId).toBe("ts-no-var")
  })

  it("analyzes Python eval", async () => {
    const code = `eval("code")`
    const result = await analyzeCode(code, "python", [getQueryById("py-no-eval")!])
    expect(result.matches.length).toBe(1)
    expect(result.matches[0].queryId).toBe("py-no-eval")
  })

  it("analyzes Python print", async () => {
    const code = `print("hello")`
    const result = await analyzeCode(code, "python", [getQueryById("py-no-print")!])
    expect(result.matches.length).toBe(1)
  })

  it("detects Python mutable default argument", async () => {
    const code = `def process(items=[]):\n    return items`
    const result = await analyzeCode(code, "python", [getQueryById("py-mutable-default-arg")!])
    expect(result.matches.length).toBe(1)
    expect(result.matches[0].queryId).toBe("py-mutable-default-arg")
  })

  it("detects Java @Autowired field injection", async () => {
    const code = `
@Service
public class MyService {
    @Autowired
    private Repo repo;
}
`
    const result = await analyzeCode(code, "java", [getQueryById("java-field-injection")!])
    expect(result.matches.length).toBe(1)
    expect(result.matches[0].queryId).toBe("java-field-injection")
  })

  it("detects Go fmt.Println", async () => {
    const code = `package main\nimport "fmt"\nfunc main() { fmt.Println("hi") }`
    const result = await analyzeCode(code, "go", [getQueryById("go-fmt-println")!])
    expect(result.matches.length).toBe(1)
  })

  it("detects Rust unwrap", async () => {
    const code = `fn main() { let x: Option<i32> = Some(1); x.unwrap(); }`
    const result = await analyzeCode(code, "rust", [getQueryById("rust-unwrap")!])
    expect(result.matches.length).toBe(1)
  })

  it("detects Rust todo!()", async () => {
    const code = `fn main() { todo!(); }`
    const result = await analyzeCode(code, "rust", [getQueryById("rust-todo")!])
    expect(result.matches.length).toBe(1)
  })

  it("analyzeWithBuiltins runs all builtins for a language", async () => {
    const code = `const x: any = 5; eval("code"); console.log("test"); debugger;`
    const result = await analyzeWithBuiltins(code, "typescript")
    expect(result.matches.length).toBeGreaterThan(0)
  })

  it("analyzeWithBuiltins with specific IDs", async () => {
    const code = `const x: any = 5; eval("code");`
    const result = await analyzeWithBuiltins(code, "typescript", ["ts-no-any", "ts-no-eval"])
    expect(result.matches.length).toBe(2)
  })

  it("reports parse time and query time", async () => {
    const result = await analyzeCode("const x = 1;", "typescript")
    expect(result.parseTimeMs).toBeGreaterThanOrEqual(0)
    expect(result.queryTimeMs).toBeGreaterThanOrEqual(0)
  })
})

describe("ASTMatcher", () => {
  function makeRule(overrides: Partial<Rule> = {}): Rule {
    return {
      id: "test-rule",
      title: "Test Rule",
      content: "# Test\n- No eval allowed\n<!-- ast:\nbuiltins: [\"ts-no-eval\"]\n-->",
      category: "security",
      severity: "error",
      modality: "must",
      tags: ["security", "eval"],
      stack: ["typescript"],
      scope: [],
      changeTypes: [],
      team: [],
      filePath: "test.md",
      ...overrides,
    }
  }

  it("can be instantiated", () => {
    const matcher = new ASTMatcher()
    expect(matcher.name).toBe("ast")
  })

  it("returns NOT_COVERED when no code is found", async () => {
    const matcher = new ASTMatcher()
    const results = await matcher.match({
      plan: "This is just a text description with no code",
      rules: [makeRule()],
    })
    expect(results.length).toBe(1)
    expect(results[0].status).toBe("NOT_COVERED")
  })
})
