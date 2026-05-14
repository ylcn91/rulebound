import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { applyWaivers, loadWaivers, loadWaiversWithErrors, validateDeterministic } from "../index.js"
import type { CheckResult, Rule, RuleCheck } from "../index.js"

function violation(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    ruleId: "test.rule",
    checkId: "regex:abc",
    status: "VIOLATED",
    source: "regex",
    deterministic: true,
    confidence: "exact",
    blocking: true,
    reason: "matched forbidden pattern",
    evidence: { filePath: "src/legacy/foo.ts" },
    ...overrides,
  }
}

describe("applyWaivers", () => {
  it("downgrades blocking to advisory when matched", () => {
    const { results, applied } = applyWaivers(
      [violation()],
      [{ rule: "test.rule", reason: "legacy", owner: "@alice", expires: "2099-01-01" }],
    )
    expect(results[0].blocking).toBe(false)
    expect(results[0].reason).toContain("[waived: legacy")
    expect(applied).toHaveLength(1)
    expect(applied[0].expired).toBe(false)
  })

  it("does not waive expired waivers", () => {
    const { results, applied } = applyWaivers(
      [violation()],
      [{ rule: "test.rule", reason: "old", owner: "@alice", expires: "2020-01-01" }],
    )
    expect(results[0].blocking).toBe(true)
    expect(applied).toHaveLength(1)
    expect(applied[0].expired).toBe(true)
  })

  it("treats invalid expiry as expired (fail-closed)", () => {
    const { results, applied } = applyWaivers(
      [violation()],
      [{ rule: "test.rule", reason: "typo", owner: "@alice", expires: "not-a-date" }],
    )
    expect(results[0].blocking).toBe(true)
    expect(applied).toHaveLength(1)
    expect(applied[0].expired).toBe(true)
  })

  it("scoped waiver does not apply when finding has no file evidence", () => {
    const noFile = violation({ evidence: undefined })
    const { results, applied } = applyWaivers(
      [noFile],
      [{ rule: "test.rule", reason: "docs", owner: "@alice", expires: "2099-01-01", scope: ["docs/**"] }],
    )
    expect(results[0].blocking).toBe(true)
    expect(applied).toHaveLength(0)
  })

  it("respects scope glob", () => {
    const inScope = violation({ evidence: { filePath: "docs/intro.md" } })
    const outOfScope = violation({ evidence: { filePath: "src/api.ts" } })
    const { results } = applyWaivers(
      [inScope, outOfScope],
      [{ rule: "test.rule", reason: "docs-only", owner: "@alice", expires: "2099-01-01", scope: ["docs/**"] }],
    )
    expect(results[0].blocking).toBe(false)
    expect(results[1].blocking).toBe(true)
  })

  it("matches by check id when provided", () => {
    const a = violation({ checkId: "ck-1" })
    const b = violation({ checkId: "ck-2" })
    const { results } = applyWaivers(
      [a, b],
      [{ rule: "test.rule", check: "ck-1", reason: "specific", owner: "@alice", expires: "2099-01-01" }],
    )
    expect(results[0].blocking).toBe(false)
    expect(results[1].blocking).toBe(true)
  })

  it("leaves PASS/NOT_APPLICABLE untouched", () => {
    const pass: CheckResult = { ...violation(), status: "PASS", blocking: false, reason: "ok" }
    const { results, applied } = applyWaivers(
      [pass],
      [{ rule: "test.rule", reason: "x", owner: "@alice", expires: "2099-01-01" }],
    )
    expect(results[0]).toBe(pass)
    expect(applied).toHaveLength(0)
  })
})

describe("loadWaivers from disk", () => {
  let tmpDir: string
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-waivers-"))
  })
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("returns [] when file missing", () => {
    expect(loadWaivers(tmpDir)).toEqual([])
  })

  it("parses default .rulebound/waivers.yaml", () => {
    mkdirSync(join(tmpDir, ".rulebound"), { recursive: true })
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: test.rule
    reason: "x"
    owner: "@alice"
    expires: "2099-01-01"
`,
    )
    const ws = loadWaivers(tmpDir)
    expect(ws).toHaveLength(1)
    expect(ws[0].rule).toBe("test.rule")
    expect(ws[0].owner).toBe("@alice")
  })

  it("requires owner field", () => {
    mkdirSync(join(tmpDir, ".rulebound"), { recursive: true })
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: r1
    reason: "x"
    expires: "2099-01-01"
`,
    )
    const result = loadWaiversWithErrors(tmpDir)
    expect(result.waivers).toHaveLength(0)
    expect(result.errors.some((e) => e.message.includes("owner"))).toBe(true)
  })

  it("requires expires field", () => {
    mkdirSync(join(tmpDir, ".rulebound"), { recursive: true })
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: r1
    reason: "x"
    owner: "@alice"
`,
    )
    const result = loadWaiversWithErrors(tmpDir)
    expect(result.waivers).toHaveLength(0)
    expect(result.errors.some((e) => e.message.includes("expires"))).toBe(true)
  })

  it("path field is normalized into scope", () => {
    mkdirSync(join(tmpDir, ".rulebound"), { recursive: true })
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: r1
    reason: "x"
    owner: "@alice"
    expires: "2099-01-01"
    path: "src/legacy/foo.ts"
`,
    )
    const result = loadWaiversWithErrors(tmpDir)
    expect(result.errors).toEqual([])
    expect(result.waivers).toHaveLength(1)
    expect(result.waivers[0].scope).toEqual(["src/legacy/foo.ts"])
  })

  it("loadWaiversWithErrors surfaces missing required fields", () => {
    mkdirSync(join(tmpDir, ".rulebound"), { recursive: true })
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: ""
    reason: "x"
    owner: "@alice"
    expires: "2099-01-01"
  - rule: ok.rule
    owner: "@alice"
    expires: "2099-01-01"
`,
    )
    const result = loadWaiversWithErrors(tmpDir)
    expect(result.waivers).toHaveLength(0)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
    expect(result.errors.some((e) => e.message.includes("rule"))).toBe(true)
    expect(result.errors.some((e) => e.message.includes("reason"))).toBe(true)
  })

  it("loadWaiversWithErrors flags unparseable expires", () => {
    mkdirSync(join(tmpDir, ".rulebound"), { recursive: true })
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: r1
    reason: "x"
    owner: "@alice"
    expires: "tomorrow-maybe"
`,
    )
    const result = loadWaiversWithErrors(tmpDir)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some((e) => e.message.includes("expires"))).toBe(true)
  })

  it("loadWaiversWithErrors flags missing 'waivers' key", () => {
    mkdirSync(join(tmpDir, ".rulebound"), { recursive: true })
    writeFileSync(join(tmpDir, ".rulebound", "waivers.yaml"), `some_other_root: 1\n`)
    const result = loadWaiversWithErrors(tmpDir)
    expect(result.errors.some((e) => e.message.includes("waivers"))).toBe(true)
  })

  it("loadWaiversWithErrors reports missing file when --waivers explicitly given", () => {
    const result = loadWaiversWithErrors(tmpDir, "missing.yaml")
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toMatch(/not found/)
  })
})

describe("validateDeterministic + waivers integration", () => {
  let tmpDir: string
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-w-int-"))
  })
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("waived violation does not flip status to FAILED", async () => {
    writeFileSync(join(tmpDir, "app.ts"), "function f() { console.log('x') }\n")
    const checks: RuleCheck[] = [
      { type: "regex", pattern: "console\\.log", files: ["**/*.ts"], severity: "error" },
    ]
    const rule: Rule = {
      id: "demo.no-log",
      title: "No console.log",
      content: "",
      category: "style",
      severity: "error",
      modality: "must",
      tags: [],
      stack: [],
      scope: [],
      changeTypes: [],
      team: [],
      filePath: "demo.md",
      checks,
    }

    const failed = await validateDeterministic({ cwd: tmpDir, rules: [rule] })
    expect(failed.status).toBe("FAILED")

    const waived = await validateDeterministic({
      cwd: tmpDir,
      rules: [rule],
      waivers: [{ rule: "demo.no-log", reason: "legacy", owner: "@alice", expires: "2099-01-01" }],
    })
    expect(waived.status).toBe("PASSED_WITH_WARNINGS")
    expect(waived.summary.waived).toBe(1)
    expect(waived.waiversApplied).toHaveLength(1)
    const waivedResult = waived.results.find((r) => r.status === "VIOLATED")
    expect(waivedResult?.waived?.reason).toBe("legacy")
  })
})
