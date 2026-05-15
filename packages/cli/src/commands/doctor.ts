import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { execFileSync } from "node:child_process"
import chalk from "chalk"
import { findRulesDir, detectProjectStack, loadRulesWithInheritance } from "@rulebound/engine"
import type { Rule, RuleCheck } from "@rulebound/engine"

interface CheckItem {
  readonly name: string
  readonly status: "ok" | "warn" | "fail"
  readonly detail: string
}

function which(cmd: string): string | undefined {
  try {
    const out = execFileSync("/bin/sh", ["-c", `command -v ${cmd}`], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return out || undefined
  } catch {
    return undefined
  }
}

interface AnalyzerExpectation {
  readonly tool: string
  readonly reports: readonly string[]
}

function analyzerExpectations(rules: readonly Rule[]): AnalyzerExpectation[] {
  const byTool = new Map<string, Set<string>>()
  for (const rule of rules) {
    for (const check of rule.checks ?? []) {
      if (check.type !== "analyzer") continue
      const expectation = check as Extract<RuleCheck, { type: "analyzer" }>
      const set = byTool.get(expectation.analyzer) ?? new Set<string>()
      set.add(expectation.report)
      byTool.set(expectation.analyzer, set)
    }
  }
  return [...byTool.entries()].map(([tool, reports]) => ({ tool, reports: [...reports] }))
}

const ANALYZER_TO_CMD: Record<string, readonly string[]> = {
  pmd: ["pmd", "mvn"],
  checkstyle: ["mvn"],
  spotbugs: ["mvn"],
  junit: ["mvn", "gradle"],
  eslint: ["eslint", "pnpm", "npm", "yarn"],
  tsc: ["tsc", "pnpm", "npm", "yarn"],
  semgrep: ["semgrep"],
  gitleaks: ["gitleaks"],
  "dependency-cruiser": ["depcruise", "pnpm", "npm"],
  sarif: [],
  generic: [],
}

/**
 * Per-analyzer "next action" hint shown when the tool IS on PATH but the
 * expected report file is not yet present. The hint is a concrete command
 * the user can paste — generic enough to work without project knowledge,
 * specific enough to point at the right ecosystem (Maven plugin vs npm
 * script, etc.).
 */
const ANALYZER_TO_RUN_HINT: Record<string, string> = {
  pmd: "mvn pmd:check",
  checkstyle: "mvn checkstyle:check",
  spotbugs: "mvn spotbugs:check",
  junit: "mvn test",
  eslint:
    "pnpm eslint . --format json --output-file eslint-report.json",
  tsc: "pnpm tsc --noEmit",
  semgrep: "semgrep --config auto --json --output semgrep.json",
  gitleaks: "gitleaks detect --no-banner --report-format json --report-path gitleaks.json",
  "dependency-cruiser": "pnpm depcruise --output-type json src > depcruise.json",
}

function commandRequiringAllowFlag(rules: readonly Rule[]): number {
  let n = 0
  for (const rule of rules) {
    for (const check of rule.checks ?? []) {
      if (check.type === "command") n += 1
      if (check.type === "analyzer" && (check as Extract<RuleCheck, { type: "analyzer" }>).run) n += 1
    }
  }
  return n
}

export async function doctorCommand(): Promise<void> {
  const cwd = process.cwd()
  const items: CheckItem[] = []

  const rulesDir = findRulesDir(cwd)
  items.push({
    name: "rules dir",
    status: rulesDir ? "ok" : "fail",
    detail: rulesDir ?? "missing (run 'rulebound init --examples')",
  })

  let rules: readonly Rule[] = []
  if (rulesDir) {
    rules = loadRulesWithInheritance(cwd)
    const determ = rules.filter((r) => r.checks && r.checks.length > 0).length
    const advisory = rules.length - determ
    items.push({
      name: "rules loaded",
      status: rules.length > 0 ? "ok" : "warn",
      detail: `${rules.length} total · ${determ} deterministic · ${advisory} advisory-only`,
    })
    const parseErrors = rules.filter((r) => r.checkParseErrors && r.checkParseErrors.length > 0)
    if (parseErrors.length > 0) {
      items.push({
        name: "rule schema",
        status: "fail",
        detail: `${parseErrors.length} rule(s) have invalid checks: ${parseErrors.map((r) => r.id).join(", ")}`,
      })
    }
  }

  const stack = detectProjectStack(cwd)
  items.push({
    name: "project stack",
    status: stack.length > 0 ? "ok" : "warn",
    detail: stack.length > 0 ? stack.join(", ") : "unknown",
  })

  const isGit = existsSync(join(cwd, ".git"))
  items.push({
    name: "git repo",
    status: isGit ? "ok" : "warn",
    detail: isGit ? cwd : "not a git repo (diff-evidence checks need git)",
  })

  const config = existsSync(resolve(cwd, ".rulebound", "config.json"))
  items.push({
    name: "config",
    status: config ? "ok" : "warn",
    detail: config ? ".rulebound/config.json" : "no .rulebound/config.json (defaults applied)",
  })

  const baseToolchains = ["node", "pnpm", "git", "java", "mvn", "gradle", "python", "go", "cargo"]
  const detectedBase = baseToolchains.filter((t) => which(t))
  items.push({
    name: "toolchains",
    status: detectedBase.length > 0 ? "ok" : "warn",
    detail: detectedBase.join(", ") || "none detected",
  })

  const analyzersWanted = analyzerExpectations(rules)
  if (analyzersWanted.length === 0) {
    items.push({
      name: "analyzer checks",
      status: "ok",
      detail: "no `type: analyzer` checks configured",
    })
  } else {
    for (const expectation of analyzersWanted) {
      const cmds = ANALYZER_TO_CMD[expectation.tool] ?? []
      const cmdHit = cmds.length === 0 || cmds.some((c) => which(c))
      const missingReports = expectation.reports.filter((p) => !existsSync(resolve(cwd, p)))
      const haveReports = expectation.reports.length - missingReports.length
      const runHint = ANALYZER_TO_RUN_HINT[expectation.tool]
      let status: CheckItem["status"] = "ok"
      let detail: string
      if (!cmdHit) {
        status = "warn"
        detail = `${expectation.tool}: required tool not found on PATH (${cmds.join(", ")})`
      } else if (missingReports.length === expectation.reports.length) {
        status = "warn"
        detail = `${expectation.tool}: tool present, but report file(s) not found yet: ${expectation.reports.join(", ")} — run the analyzer first or pass --allow-commands`
        if (runHint) detail += ` (next: ${runHint})`
      } else if (missingReports.length > 0) {
        status = "warn"
        detail = `${expectation.tool}: ${haveReports}/${expectation.reports.length} report(s) present. Missing: ${missingReports.join(", ")}`
        if (runHint) detail += ` (next: ${runHint})`
      } else {
        detail = `${expectation.tool}: ${haveReports} report(s) ready`
      }
      items.push({ name: `analyzer:${expectation.tool}`, status, detail })
    }
  }

  const commandChecks = commandRequiringAllowFlag(rules)
  if (commandChecks > 0) {
    items.push({
      name: "command checks",
      status: "warn",
      detail: `${commandChecks} check(s) require '--allow-commands' to execute (subprocess-disabled by default)`,
    })
  }

  const claudeMd = ["AGENTS.md", "CLAUDE.md", ".cursorrules", ".cursor/rules"].filter((p) => existsSync(join(cwd, p)))
  items.push({
    name: "agent configs",
    status: "ok",
    detail: claudeMd.length > 0 ? claudeMd.join(", ") : "none found",
  })

  console.log()
  console.log(chalk.bold("rulebound doctor"))
  console.log()
  for (const item of items) {
    const symbol = item.status === "ok" ? chalk.green("✓") : item.status === "warn" ? chalk.yellow("!") : chalk.red("✗")
    console.log(`  ${symbol} ${chalk.bold(item.name.padEnd(22))} ${item.detail}`)
  }
  console.log()

  const failed = items.filter((i) => i.status === "fail").length
  process.exit(failed > 0 ? 2 : 0)
}
