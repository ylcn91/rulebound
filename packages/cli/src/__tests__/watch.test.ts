import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  shouldIgnore,
  formatPrettyAST,
  formatPrettyRule,
  formatJsonAST,
  formatJsonRule,
  createDebouncer,
  type ASTViolation,
  type RuleViolation,
} from "../lib/watch-format.js"

// --- Tests ---

describe("shouldIgnore", () => {
  const defaults = ["node_modules", ".git", "dist", ".next", "coverage"]

  it("ignores paths containing node_modules", () => {
    expect(shouldIgnore("src/node_modules/foo/bar.ts", defaults)).toBe(true)
  })

  it("ignores paths containing .git", () => {
    expect(shouldIgnore(".git/objects/abc", defaults)).toBe(true)
  })

  it("ignores paths containing dist", () => {
    expect(shouldIgnore("packages/cli/dist/index.js", defaults)).toBe(true)
  })

  it("ignores paths containing .next", () => {
    expect(shouldIgnore("apps/web/.next/cache/foo", defaults)).toBe(true)
  })

  it("ignores paths containing coverage", () => {
    expect(shouldIgnore("coverage/lcov-report/index.html", defaults)).toBe(true)
  })

  it("does not ignore normal source files", () => {
    expect(shouldIgnore("src/commands/watch.ts", defaults)).toBe(false)
  })

  it("does not ignore unrelated paths", () => {
    expect(shouldIgnore("src/utils/format.ts", defaults)).toBe(false)
  })

  it("handles custom ignore patterns", () => {
    const custom = [...defaults, "build", "tmp"]
    expect(shouldIgnore("build/output.js", custom)).toBe(true)
    expect(shouldIgnore("tmp/cache.json", custom)).toBe(true)
  })

  it("returns false for empty patterns array", () => {
    expect(shouldIgnore("src/index.ts", [])).toBe(false)
  })
})

describe("formatPrettyAST", () => {
  it("formats error violations with [ERROR] tag", () => {
    const result = formatPrettyAST({
      file: "src/auth.ts",
      line: 15,
      rule: "ts-no-any",
      severity: "error",
      message: "Disallow 'any' type annotation",
    })

    expect(result).toContain("[ERROR]")
    expect(result).toContain("src/auth.ts:15")
    expect(result).toContain("ts-no-any")
    expect(result).toContain("Disallow 'any' type annotation")
  })

  it("formats warning violations with [WARN] tag", () => {
    const result = formatPrettyAST({
      file: "src/utils.ts",
      line: 42,
      rule: "ts-no-console",
      severity: "warning",
      message: "Avoid console.log",
    })

    expect(result).toContain("[WARN]")
    expect(result).toContain("src/utils.ts:42")
    expect(result).toContain("ts-no-console")
  })

  it("formats info violations with [INFO] tag", () => {
    const result = formatPrettyAST({
      file: "src/helpers.ts",
      line: 1,
      rule: "ts-complexity",
      severity: "info",
      message: "Function complexity high",
    })

    expect(result).toContain("[INFO]")
    expect(result).toContain("src/helpers.ts:1")
  })
})

describe("formatPrettyRule", () => {
  it("formats error rule violations", () => {
    const result = formatPrettyRule({
      file: "src/auth.ts",
      rule: "No Hardcoded Secrets",
      severity: "error",
      message: "Rule violated",
      status: "VIOLATED",
    })

    expect(result).toContain("[ERROR]")
    expect(result).toContain("src/auth.ts")
    expect(result).toContain("No Hardcoded Secrets")
  })

  it("formats warning rule violations", () => {
    const result = formatPrettyRule({
      file: "src/auth.ts",
      rule: "Testing Required",
      severity: "warning",
      message: "Tests missing",
      status: "VIOLATED",
    })

    expect(result).toContain("[WARN]")
    expect(result).toContain("Testing Required")
  })

  it("formats info rule violations", () => {
    const result = formatPrettyRule({
      file: "src/auth.ts",
      rule: "Code Style",
      severity: "info",
      message: "Not covered",
      status: "NOT_COVERED",
    })

    expect(result).toContain("[INFO]")
    expect(result).toContain("Code Style")
  })
})

describe("formatJsonAST", () => {
  it("outputs valid NDJSON for AST violations", () => {
    const violation: ASTViolation = {
      file: "src/auth.ts",
      line: 15,
      rule: "ts-no-any",
      severity: "error",
      message: "Disallow 'any' type annotation",
    }

    const result = formatJsonAST(violation)
    const parsed = JSON.parse(result)

    expect(parsed).toEqual({
      file: "src/auth.ts",
      line: 15,
      rule: "ts-no-any",
      severity: "error",
      message: "Disallow 'any' type annotation",
    })
  })
})

describe("formatJsonRule", () => {
  it("outputs valid NDJSON for rule violations", () => {
    const violation: RuleViolation = {
      file: "src/auth.ts",
      rule: "No Hardcoded Secrets",
      severity: "warning",
      message: "Rule violated",
      status: "VIOLATED",
    }

    const result = formatJsonRule(violation)
    const parsed = JSON.parse(result)

    expect(parsed).toEqual({
      file: "src/auth.ts",
      rule: "No Hardcoded Secrets",
      severity: "warning",
      message: "Rule violated",
    })
  })
})

describe("createDebouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("calls the function after the delay", () => {
    const debounce = createDebouncer(300)
    const fn = vi.fn()

    debounce("file.ts", fn)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledOnce()
  })

  it("resets the timer on repeated calls for the same key", () => {
    const debounce = createDebouncer(300)
    const fn = vi.fn()

    debounce("file.ts", fn)
    vi.advanceTimersByTime(200)

    debounce("file.ts", fn)
    vi.advanceTimersByTime(200)

    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledOnce()
  })

  it("handles multiple keys independently", () => {
    const debounce = createDebouncer(300)
    const fn1 = vi.fn()
    const fn2 = vi.fn()

    debounce("a.ts", fn1)
    vi.advanceTimersByTime(100)

    debounce("b.ts", fn2)
    vi.advanceTimersByTime(200)

    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn2).toHaveBeenCalledOnce()
  })

  it("uses the latest function on reset", () => {
    const debounce = createDebouncer(300)
    const fn1 = vi.fn()
    const fn2 = vi.fn()

    debounce("file.ts", fn1)
    vi.advanceTimersByTime(100)

    debounce("file.ts", fn2)
    vi.advanceTimersByTime(300)

    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it("works with zero delay", () => {
    const debounce = createDebouncer(0)
    const fn = vi.fn()

    debounce("file.ts", fn)
    vi.advanceTimersByTime(0)

    expect(fn).toHaveBeenCalledOnce()
  })
})
