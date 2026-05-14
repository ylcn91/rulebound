import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  validateDeterministic,
  parseChecksYaml,
  parseRuleChecks,
  loadLocalRules,
} from "../index.js"
import type { Rule, RuleCheck } from "../index.js"

function makeRule(checks: readonly RuleCheck[], overrides: Partial<Rule> = {}): Rule {
  return {
    id: "test-rule",
    title: "Test Rule",
    content: "",
    category: "test",
    severity: "error",
    modality: "must",
    tags: [],
    stack: [],
    scope: [],
    changeTypes: [],
    team: [],
    filePath: "test.md",
    checks,
    ...overrides,
  }
}

describe("parseChecksYaml", () => {
  it("parses single regex check", () => {
    const { checks, errors } = parseChecksYaml(`
checks:
  - type: regex
    pattern: "console\\\\.log"
    severity: error
`)
    expect(errors).toEqual([])
    expect(checks).toHaveLength(1)
    expect(checks[0].type).toBe("regex")
  })

  it("rejects unknown check type", () => {
    const { checks, errors } = parseChecksYaml(`
checks:
  - type: unknown
`)
    expect(checks).toHaveLength(0)
    expect(errors.length).toBeGreaterThan(0)
  })

  it("requires required fields", () => {
    const { errors } = parseChecksYaml(`
checks:
  - type: file-exists
`)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toContain("path")
  })

  it("parses diff-evidence with arrays", () => {
    const { checks, errors } = parseChecksYaml(`
checks:
  - type: diff-evidence
    when_changed:
      - "src/**/*.ts"
    require_changed:
      - "tests/**/*.ts"
`)
    expect(errors).toEqual([])
    expect(checks).toHaveLength(1)
    if (checks[0].type === "diff-evidence") {
      expect(checks[0].when_changed).toEqual(["src/**/*.ts"])
      expect(checks[0].require_changed).toEqual(["tests/**/*.ts"])
    }
  })
})

describe("parseRuleChecks fenced block", () => {
  it("extracts from rulebound fenced block in body", () => {
    const body = `Some text.

\`\`\`rulebound
checks:
  - type: file-exists
    path: README.md
\`\`\`

Trailing text.`
    const { checks, errors } = parseRuleChecks("", body)
    expect(errors).toEqual([])
    expect(checks).toHaveLength(1)
    expect(checks[0].type).toBe("file-exists")
  })
})

describe("validateDeterministic", () => {
  let tmpDir: string
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-test-"))
  })
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("file-exists PASS when file exists", async () => {
    writeFileSync(join(tmpDir, "README.md"), "hello")
    const rule = makeRule([{ type: "file-exists", path: "README.md" }])
    const report = await validateDeterministic({ cwd: tmpDir, rules: [rule] })
    expect(report.status).toBe("PASSED")
    expect(report.summary.pass).toBe(1)
  })

  it("file-exists FAILED when file missing", async () => {
    const rule = makeRule([{ type: "file-exists", path: "missing.md" }])
    const report = await validateDeterministic({ cwd: tmpDir, rules: [rule] })
    expect(report.status).toBe("FAILED")
    expect(report.summary.blocking).toBe(1)
  })

  it("regex forbidden hits violation", async () => {
    writeFileSync(join(tmpDir, "app.ts"), "function f() { console.log('x') }\n")
    const rule = makeRule([
      { type: "regex", pattern: "console\\.log", files: ["**/*.ts"], severity: "error" },
    ])
    const report = await validateDeterministic({ cwd: tmpDir, rules: [rule] })
    expect(report.status).toBe("FAILED")
    const violation = report.results.find((r) => r.status === "VIOLATED")
    expect(violation?.evidence?.filePath).toBe("app.ts")
    expect(violation?.evidence?.line).toBe(1)
  })

  it("regex require=true fails when pattern never present", async () => {
    writeFileSync(join(tmpDir, "app.ts"), "function f() {}\n")
    const rule = makeRule([
      { type: "regex", pattern: "Copyright", require: true, files: ["**/*.ts"], severity: "error" },
    ])
    const report = await validateDeterministic({ cwd: tmpDir, rules: [rule] })
    expect(report.status).toBe("FAILED")
  })

  it("diff-evidence PASS when require_changed matched", async () => {
    const rule = makeRule([
      {
        type: "diff-evidence",
        when_changed: ["src/db/schema.ts"],
        require_changed: ["migrations/**/*.sql"],
      },
    ])
    const report = await validateDeterministic({
      cwd: tmpDir,
      rules: [rule],
      changedFiles: ["src/db/schema.ts", "migrations/2026_05_14_init.sql"],
    })
    expect(report.status).toBe("PASSED")
  })

  it("diff-evidence FAILED when missing required evidence", async () => {
    const rule = makeRule([
      {
        type: "diff-evidence",
        when_changed: ["src/db/schema.ts"],
        require_changed: ["migrations/**/*.sql"],
      },
    ])
    const report = await validateDeterministic({
      cwd: tmpDir,
      rules: [rule],
      changedFiles: ["src/db/schema.ts"],
    })
    expect(report.status).toBe("FAILED")
    const violation = report.results.find((r) => r.status === "VIOLATED")
    expect(violation?.source).toBe("diff")
  })

  it("diff-evidence NOT_APPLICABLE when trigger not matched", async () => {
    const rule = makeRule([
      {
        type: "diff-evidence",
        when_changed: ["src/db/schema.ts"],
        require_changed: ["migrations/**/*.sql"],
      },
    ])
    const report = await validateDeterministic({
      cwd: tmpDir,
      rules: [rule],
      changedFiles: ["docs/readme.md"],
    })
    expect(report.status).toBe("PASSED")
    expect(report.summary.notApplicable).toBe(1)
  })

  it("forbidden-import flags TS boundary cross", async () => {
    mkdirSync(join(tmpDir, "src/domain"), { recursive: true })
    mkdirSync(join(tmpDir, "src/infra"), { recursive: true })
    writeFileSync(join(tmpDir, "src/domain/user.ts"), `import { db } from "../infra/db"\n`)
    const rule = makeRule([
      {
        type: "forbidden-import",
        from: ["src/domain/**"],
        importing: ["../infra/db", "src/infra/*"],
      },
    ])
    const report = await validateDeterministic({ cwd: tmpDir, rules: [rule] })
    expect(report.status).toBe("FAILED")
  })

  it("command check skipped without allowCommandExecution", async () => {
    const rule = makeRule([{ type: "command", run: "true" }])
    const report = await validateDeterministic({ cwd: tmpDir, rules: [rule], allowCommandExecution: false })
    expect(report.status).toBe("PASSED")
    expect(report.summary.notApplicable).toBe(1)
  })

  it("agent-process PASS when signal present", async () => {
    const rule = makeRule([
      { type: "agent-process", require: "find_rules_called", severity: "warning" },
    ])
    const report = await validateDeterministic({
      cwd: tmpDir,
      rules: [rule],
      agentSignals: { findRulesCalled: true },
    })
    expect(report.status).toBe("PASSED")
  })

  it("agent-process VIOLATED when signal missing", async () => {
    const rule = makeRule([
      { type: "agent-process", require: "bugfix_spec_present", severity: "error" },
    ])
    const report = await validateDeterministic({ cwd: tmpDir, rules: [rule] })
    expect(report.status).toBe("FAILED")
  })

  it("rule with no checks is labeled ADVISORY", async () => {
    const rule = makeRule([], { checks: undefined })
    const report = await validateDeterministic({ cwd: tmpDir, rules: [rule] })
    expect(report.ruleStatuses[0].status).toBe("ADVISORY")
    expect(report.status).toBe("PASSED")
  })

  it("captures schema parse errors per rule", async () => {
    const ruleWithError: Rule = {
      ...makeRule([]),
      checks: undefined,
      checkParseErrors: ["bad schema"],
    }
    const report = await validateDeterministic({ cwd: tmpDir, rules: [ruleWithError] })
    expect(report.parseErrors).toHaveLength(1)
    expect(report.parseErrors[0].errors).toContain("bad schema")
  })

  it("aggregates rule statuses", async () => {
    writeFileSync(join(tmpDir, "README.md"), "x")
    const rule = makeRule([{ type: "file-exists", path: "README.md" }])
    const report = await validateDeterministic({ cwd: tmpDir, rules: [rule] })
    expect(report.ruleStatuses).toHaveLength(1)
    expect(report.ruleStatuses[0].status).toBe("PASS")
  })
})

describe("loadLocalRules parses checks", () => {
  let tmpDir: string
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-rules-"))
  })
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("parses YAML frontmatter checks", () => {
    writeFileSync(
      join(tmpDir, "secrets.md"),
      `---
title: No Secrets
severity: error
modality: must
tags: [security]
checks:
  - type: regex
    pattern: "AKIA"
    severity: error
---

Do not commit AWS keys.
`,
    )
    const rules = loadLocalRules(tmpDir)
    expect(rules).toHaveLength(1)
    expect(rules[0].checks).toHaveLength(1)
    expect(rules[0].checks?.[0].type).toBe("regex")
  })

  it("parses fenced rulebound block", () => {
    writeFileSync(
      join(tmpDir, "evidence.md"),
      `---
title: Migration Required
---

Schema changes need migrations.

\`\`\`rulebound
checks:
  - type: diff-evidence
    when_changed: ["schema.ts"]
    require_changed: ["migrations/*.sql"]
\`\`\`
`,
    )
    const rules = loadLocalRules(tmpDir)
    expect(rules[0].checks).toHaveLength(1)
    expect(rules[0].checks?.[0].type).toBe("diff-evidence")
  })
})
