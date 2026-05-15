import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { validateDeterministic } from "../checks/deterministic.js"
import { loadLocalRules } from "../rule-loader.js"

/**
 * MCP-003 — agent-process signal taxonomy contract.
 *
 * Pins the behaviour documented in docs/agent-process-signals.md:
 *
 *   - On the default branch with no MCP loop, a warning-severity
 *     agent-process check produces a non-blocking advisory.
 *   - On a fix/** branch with no MCP signal, same: non-blocking advisory.
 *   - On a fix/** branch with the signal set, the check passes.
 *   - An error-severity agent-process check on the default branch is the
 *     anti-pattern: it blocks. This is intentional and pins the contract;
 *     rule authors must pair it with branch_matches (via diff-evidence) to
 *     avoid the noise.
 */

let tmpDir: string

function writeRule(file: string, body: string): void {
  const rulesDir = join(tmpDir, ".rulebound", "rules")
  mkdirSync(rulesDir, { recursive: true })
  writeFileSync(join(rulesDir, file), body, "utf-8")
}

const PAIRED_BUGFIX_RULE = `---
title: Bugfix branch requires a bugfix spec
category: workflow
severity: error
modality: must
checks:
  - type: diff-evidence
    id: bugfix-spec-present
    branch_matches: '^fix/'
    require_changed:
      - ".rulebound/bugfixes/*.md"
    severity: error
    message: "Branch fix/* must include a bugfix spec under .rulebound/bugfixes/."
  - type: agent-process
    id: bugfix-spec-agent-signal
    require: bugfix_spec_present
    severity: warning
    message: "Agent did not register a bugfix spec before this run."
---

Branch fix/** must carry a bugfix spec.
`

const ADVISORY_ONLY_AGENT_PROCESS = `---
title: Agent must find rules first
category: workflow
severity: warning
modality: should
checks:
  - type: agent-process
    id: find-rules-called
    require: find_rules_called
    severity: warning
    message: "Agent did not call find_rules before proposing a change."
---
`

const ERROR_LEVEL_AGENT_PROCESS = `---
title: Agent process anti-pattern (error severity, no branch scope)
category: workflow
severity: error
modality: must
checks:
  - type: agent-process
    id: regression-test-required
    require: regression_test_added
    severity: error
    message: "Regression test must be added."
---
`

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "rulebound-agent-signals-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("agent-process: default branch, no MCP loop", () => {
  it("warning-severity check produces non-blocking advisory (rule status PASSED_WITH_WARNINGS)", async () => {
    writeRule("advisory.md", ADVISORY_ONLY_AGENT_PROCESS)
    const rules = loadLocalRules(join(tmpDir, ".rulebound", "rules"))

    const report = await validateDeterministic({
      cwd: tmpDir,
      rules,
      branch: "main",
      // agentSignals omitted → all signals missing.
    })

    expect(report.status).toBe("PASSED_WITH_WARNINGS")
    expect(report.summary.violated).toBe(1)
    expect(report.summary.blocking).toBe(0)
    const violation = report.results.find((r) => r.checkId === "find-rules-called")
    expect(violation?.status).toBe("VIOLATED")
    expect(violation?.blocking).toBe(false)
  })

  it("paired (diff-evidence + agent-process) rule: default branch is NOT_APPLICABLE on the diff side", async () => {
    writeRule("bugfix.md", PAIRED_BUGFIX_RULE)
    const rules = loadLocalRules(join(tmpDir, ".rulebound", "rules"))

    const report = await validateDeterministic({
      cwd: tmpDir,
      rules,
      branch: "main",
      changedFiles: ["src/feature.ts"],
    })

    const diffResult = report.results.find((r) => r.checkId === "bugfix-spec-present")
    const signalResult = report.results.find((r) => r.checkId === "bugfix-spec-agent-signal")

    // Diff-evidence is gated by branch_matches → NOT_APPLICABLE on main.
    expect(diffResult?.status).toBe("NOT_APPLICABLE")
    // Agent-process check has no branch gating; it fires regardless.
    // Severity=warning means non-blocking → status is advisory.
    expect(signalResult?.status).toBe("VIOLATED")
    expect(signalResult?.blocking).toBe(false)
    expect(report.status).toBe("PASSED_WITH_WARNINGS")
    expect(report.summary.blocking).toBe(0)
  })
})

describe("agent-process: fix/** branch, no MCP signal", () => {
  it("paired rule: diff-evidence blocks when spec missing; agent-process is advisory", async () => {
    writeRule("bugfix.md", PAIRED_BUGFIX_RULE)
    const rules = loadLocalRules(join(tmpDir, ".rulebound", "rules"))

    const report = await validateDeterministic({
      cwd: tmpDir,
      rules,
      branch: "fix/payment-rounding",
      changedFiles: ["src/payment.ts"], // No bugfix spec in the diff.
    })

    const diffResult = report.results.find((r) => r.checkId === "bugfix-spec-present")
    const signalResult = report.results.find((r) => r.checkId === "bugfix-spec-agent-signal")

    // Diff-evidence is now active and missing the spec → VIOLATED + blocking.
    expect(diffResult?.status).toBe("VIOLATED")
    expect(diffResult?.blocking).toBe(true)
    // Agent-process check fires as advisory.
    expect(signalResult?.status).toBe("VIOLATED")
    expect(signalResult?.blocking).toBe(false)
    expect(report.status).toBe("FAILED")
  })
})

describe("agent-process: fix/** branch, MCP signal present", () => {
  it("agent-process check passes when bugfixSpecPath is set", async () => {
    writeRule("bugfix.md", PAIRED_BUGFIX_RULE)
    const rules = loadLocalRules(join(tmpDir, ".rulebound", "rules"))

    // Simulate MCP loop: spec exists in diff AND signal is set.
    const report = await validateDeterministic({
      cwd: tmpDir,
      rules,
      branch: "fix/payment-rounding",
      changedFiles: [
        "src/payment.ts",
        ".rulebound/bugfixes/2026-05-15-rounding.md",
      ],
      agentSignals: {
        bugfixSpecPath: ".rulebound/bugfixes/2026-05-15-rounding.md",
      },
    })

    const diffResult = report.results.find((r) => r.checkId === "bugfix-spec-present")
    const signalResult = report.results.find((r) => r.checkId === "bugfix-spec-agent-signal")

    expect(diffResult?.status).toBe("PASS")
    expect(signalResult?.status).toBe("PASS")
    expect(report.status).toBe("PASSED")
  })
})

describe("agent-process: error-severity anti-pattern", () => {
  it("error-severity agent-process WITHOUT branch scope blocks the default branch (documented anti-pattern)", async () => {
    writeRule("anti.md", ERROR_LEVEL_AGENT_PROCESS)
    const rules = loadLocalRules(join(tmpDir, ".rulebound", "rules"))

    const report = await validateDeterministic({
      cwd: tmpDir,
      rules,
      branch: "main",
      // No agent signals → missing.
    })

    // This is the case the doc warns about: an error-severity agent-process
    // check with no branch_matches anchor will block on every branch.
    expect(report.status).toBe("FAILED")
    expect(report.summary.blocking).toBe(1)
  })

  it("error-severity agent-process with the right signal passes", async () => {
    writeRule("anti.md", ERROR_LEVEL_AGENT_PROCESS)
    const rules = loadLocalRules(join(tmpDir, ".rulebound", "rules"))

    const report = await validateDeterministic({
      cwd: tmpDir,
      rules,
      branch: "main",
      agentSignals: { regressionTestAdded: true },
    })

    expect(report.status).toBe("PASSED")
    expect(report.summary.blocking).toBe(0)
  })
})

describe("agent-process: signal taxonomy completeness", () => {
  // Pin the four canonical signals. Adding a fifth requires updating
  // docs/agent-process-signals.md, AgentProcessCheck.require, AgentSignals,
  // and this list — together.
  it("recognises all four documented signals", async () => {
    const signals: Array<{
      readonly require:
        | "find_rules_called"
        | "validate_plan_called"
        | "bugfix_spec_present"
        | "regression_test_added"
      readonly signalKey: keyof import("../checks/deterministic.js").AgentSignals
      readonly satisfied: import("../checks/deterministic.js").AgentSignals
    }> = [
      { require: "find_rules_called", signalKey: "findRulesCalled", satisfied: { findRulesCalled: true } },
      { require: "validate_plan_called", signalKey: "validatePlanCalled", satisfied: { validatePlanCalled: true } },
      { require: "bugfix_spec_present", signalKey: "bugfixSpecPath", satisfied: { bugfixSpecPath: ".rulebound/bugfixes/x.md" } },
      { require: "regression_test_added", signalKey: "regressionTestAdded", satisfied: { regressionTestAdded: true } },
    ]

    for (const s of signals) {
      writeRule(
        `${s.require}.md`,
        `---
title: signal ${s.require}
checks:
  - type: agent-process
    id: signal-${s.require}
    require: ${s.require}
    severity: warning
---
`,
      )
    }

    const rules = loadLocalRules(join(tmpDir, ".rulebound", "rules"))

    // With no signals → all four VIOLATED (advisory).
    const missingReport = await validateDeterministic({ cwd: tmpDir, rules })
    expect(missingReport.summary.violated).toBe(4)
    expect(missingReport.summary.blocking).toBe(0)

    // With each signal in turn → that one passes, the other three violate.
    for (const s of signals) {
      const report = await validateDeterministic({
        cwd: tmpDir,
        rules,
        agentSignals: s.satisfied,
      })
      const passed = report.results.filter((r) => r.status === "PASS")
      const violated = report.results.filter((r) => r.status === "VIOLATED")
      expect(passed).toHaveLength(1)
      expect(violated).toHaveLength(3)
      expect(passed[0].checkId).toBe(`signal-${s.require}`)
    }
  })
})
