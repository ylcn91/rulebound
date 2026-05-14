import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import {
  findRulesDir,
  loadLocalRules,
  filterRules,
  validatePlanAgainstRules,
  detectLanguageFromCode,
  detectProjectStack,
} from "./rule-loader.js"
import {
  detectLanguageFromPath,
  isSupportedLanguage,
  analyzeWithBuiltins,
} from "@rulebound/engine"
import {
  buildValidationEnforcementSummary,
  buildValidationViolations,
  recordMcpValidationTelemetry,
  shouldBlockValidation,
} from "./validation.js"
import {
  startBugfixWorkflow,
  validateBugfixPlanRequest,
} from "./bugfix.js"
import {
  runDeterministicChecks,
  checkDiff,
  getRepairInstructions,
} from "./deterministic-tools.js"

const server = new McpServer({
  name: "rulebound",
  version: "0.1.0",
})

// Auto-detect project stack once at startup
const projectStack = detectProjectStack(process.cwd())

server.tool(
  "start_bugfix_workflow",
  `Start a bugfix-boundary workflow. Use this before writing code for a bugfix so the bug condition C, postcondition P, preservation scenarios, and scope are explicit and stored under .rulebound/bugfixes/.`,
  {
    summary: z.string().describe("Short bug summary"),
    title: z.string().optional().describe("Explicit bugfix title"),
    condition: z.string().optional().describe("Explicit bug condition C"),
    postcondition: z.string().optional().describe("Explicit postcondition P"),
    preservation_scenarios: z.array(z.string()).optional().describe("Scenarios that must remain unchanged outside C"),
    root_cause_hypothesis: z.string().optional().describe("Current root cause hypothesis"),
    files_in_scope: z.array(z.string()).optional().describe("Files or paths allowed to change"),
    files_out_of_scope: z.array(z.string()).optional().describe("Files or paths that must stay unchanged"),
    spec_path: z.string().optional().describe("Optional bugfix spec path or directory"),
    write_spec: z.boolean().optional().describe("Write the spec to disk (default: true)"),
  },
  async ({
    summary,
    title,
    condition,
    postcondition,
    preservation_scenarios,
    root_cause_hypothesis,
    files_in_scope,
    files_out_of_scope,
    spec_path,
    write_spec,
  }) => ({
    content: [{
      type: "text" as const,
      text: JSON.stringify(startBugfixWorkflow({
        summary,
        title,
        condition,
        postcondition,
        preservationScenarios: preservation_scenarios,
        rootCauseHypothesis: root_cause_hypothesis,
        filesInScope: files_in_scope,
        filesOutOfScope: files_out_of_scope,
        specPath: spec_path,
        writeSpec: write_spec,
      }), null, 2),
    }],
  }),
)

server.tool(
  "validate_bugfix_plan",
  `Validate a bugfix implementation plan against the stored bugfix boundary before any code is written. This enforces root-cause, fix-validation, preservation, and scope sections.`,
  {
    plan: z.string().describe("Bugfix implementation plan markdown"),
    spec_path: z.string().optional().describe("Path to the bugfix spec file (defaults to the latest .rulebound/bugfixes/*.md)"),
    spec_markdown: z.string().optional().describe("Raw bugfix spec markdown instead of loading from disk"),
  },
  async ({ plan, spec_path, spec_markdown }) => {
    const result = validateBugfixPlanRequest({
      plan,
      specPath: spec_path,
      specMarkdown: spec_markdown,
    })

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      }],
    }
  },
)

server.tool(
  "find_rules",
  `Find relevant project rules for a given task. MUST be called before starting any implementation to understand project constraints and coding standards. Returns only rules relevant to your task and tech stack.`,
  {
    task: z.string().describe("Description of the task to find relevant rules for"),
    category: z.string().optional().describe("Filter: architecture, security, style, testing, infra, workflow"),
    tags: z.string().optional().describe("Comma-separated tags to filter by"),
    stack: z.string().optional().describe("Tech stack override (auto-detected if omitted): java, python, go, typescript, spring-boot, docker"),
  },
  async ({ task, category, tags, stack }) => {
    const rulesDir = findRulesDir(process.cwd())
    if (!rulesDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No rules directory found. Run 'rulebound init' first." }) }] }
    }

    const effectiveStack = stack ?? projectStack.join(",")
    let rules = loadLocalRules(rulesDir)
    rules = filterRules(rules, { task, category, tags, stack: effectiveStack })

    const compact = rules.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      severity: r.severity,
      modality: r.modality,
      tags: r.tags,
    }))

    return { content: [{ type: "text" as const, text: JSON.stringify(compact, null, 2) }] }
  }
)

server.tool(
  "validate_plan",
  `ADVISORY plan check against project rules using keyword/semantic matchers. This is NOT authoritative unless the matched rules carry deterministic 'checks:' blocks — for an authoritative pass/fail, call 'run_deterministic_checks' or 'check_diff' after writing code. Use this early to spot likely violations in a plan before coding.`,
  {
    plan: z.string().describe("The implementation plan text to validate"),
    task: z.string().optional().describe("Task context for better rule matching"),
  },
  async ({ plan, task }) => {
    const rulesDir = findRulesDir(process.cwd())
    if (!rulesDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ status: "PASSED", violations: [] }) }] }
    }

    const rules = loadLocalRules(rulesDir)
    // Only validate against stack-relevant rules
    const effectiveStack = projectStack.join(",")
    const relevant = effectiveStack
      ? filterRules(rules, { stack: effectiveStack })
      : rules

    const report = validatePlanAgainstRules(plan, relevant, task)
    const violations = buildValidationViolations(report, [])
    const enforcement = buildValidationEnforcementSummary(report, [])
    recordMcpValidationTelemetry({
      report,
      violations,
      enforcement,
      rulesTotal: report.rulesTotal,
      task: task ?? "validate_plan",
    })

    // Only return violations — compact output
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: report.status,
          summary: report.summary,
          violations: report.results
            .filter((r) => r.status === "VIOLATED")
            .map((r) => ({
              rule: r.ruleTitle,
              severity: r.severity,
              reason: r.reason,
              fix: r.suggestedFix,
            })),
        }, null, 2),
      }],
    }
  }
)

server.tool(
  "check_code",
  `Check a code snippet against relevant project rules. Call after writing code to verify rule compliance.`,
  {
    code: z.string().describe("The code snippet to check"),
    language: z.string().optional().describe("Programming language: java, python, go, typescript, dockerfile"),
    file_path: z.string().optional().describe("File path for context-based rule matching"),
  },
  async ({ code, language, file_path }) => {
    const rulesDir = findRulesDir(process.cwd())
    if (!rulesDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ compliant: true, violations: [] }) }] }
    }

    const detectedLang = language ?? detectLanguageFromCode(code, file_path) ?? projectStack[0]
    const rules = loadLocalRules(rulesDir)
    const relevant = filterRules(rules, { stack: detectedLang })

    // Run plan validation on the code as if it were a plan
    const report = validatePlanAgainstRules(code, relevant)
    const telemetryViolations = buildValidationViolations(report, [])
    const telemetryEnforcement = buildValidationEnforcementSummary(report, [])
    recordMcpValidationTelemetry({
      report,
      violations: telemetryViolations,
      enforcement: telemetryEnforcement,
      rulesTotal: report.rulesTotal,
      task: `check_code:${file_path ?? detectedLang ?? "unknown"}`,
    })

    const violations = report.results
      .filter((r) => r.status === "VIOLATED")
      .map((r) => ({
        rule: r.ruleTitle,
        severity: r.severity,
        detail: r.reason,
        fix: r.suggestedFix,
      }))

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ compliant: violations.length === 0, violations }, null, 2),
      }],
    }
  }
)

server.tool(
  "list_rules",
  `List all available rules for this project's tech stack.`,
  {
    category: z.string().optional().describe("Filter by category"),
  },
  async ({ category }) => {
    const rulesDir = findRulesDir(process.cwd())
    if (!rulesDir) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No rules directory found." }) }] }
    }

    let rules = loadLocalRules(rulesDir)

    // Auto-filter by project stack
    if (projectStack.length > 0) {
      rules = filterRules(rules, { stack: projectStack.join(",") })
    }

    if (category) {
      rules = rules.filter((r) => r.category.toLowerCase() === category.toLowerCase())
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(
          rules.map((r) => ({ id: r.id, title: r.title, category: r.category, severity: r.severity, modality: r.modality })),
          null, 2
        ),
      }],
    }
  }
)

server.tool(
  "validate_before_write",
  "Check code before writing to file. Returns approved:true if clean, approved:false with violations if not. AI agents MUST call this before writing any code file.",
  {
    code: z.string().describe("Code to validate before writing"),
    file_path: z.string().describe("Target file path"),
    language: z.string().optional().describe("Programming language (auto-detected from file extension if omitted)"),
  },
  async ({ code, file_path, language }) => {
    const lang = language ?? detectLanguageFromPath(file_path) ?? detectLanguageFromCode(code, file_path)

    const rulesDir = findRulesDir(process.cwd())
    const rules = rulesDir ? loadLocalRules(rulesDir) : []
    const relevantRules = lang
      ? filterRules(rules, { stack: lang })
      : rules

    const astViolations: ReadonlyArray<{
      readonly rule: string
      readonly line?: number
      readonly message: string
      readonly severity: string
    }> = lang && isSupportedLanguage(lang)
      ? await runAstAnalysis(code, lang)
      : []

    const report = relevantRules.length > 0
      ? validatePlanAgainstRules(code, relevantRules, `Writing ${file_path}`)
      : null

    const violations = buildValidationViolations(report, astViolations)
    const enforcement = buildValidationEnforcementSummary(report, astViolations)
    const approved = !shouldBlockValidation("strict", enforcement)

    recordMcpValidationTelemetry({
      report,
      violations,
      enforcement,
      rulesTotal: report?.rulesTotal ?? relevantRules.length,
      task: `validate_before_write:${file_path}`,
    })

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          approved,
          file_path,
          language: lang ?? "unknown",
          violations,
          score: enforcement.score,
          hasMustViolation: enforcement.hasMustViolation,
          hasShouldViolation: enforcement.hasShouldViolation,
          message: approved
            ? "Code is clean — safe to write"
            : `${violations.length} violation(s) found — review before writing`,
        }, null, 2),
      }],
    }
  }
)

server.tool(
  "run_deterministic_checks",
  `Run authoritative deterministic checks (file-exists, regex, diff-evidence, forbidden-import, ast, command, analyzer, agent-process) defined in rules' 'checks:' blocks against the working tree. This is the source of truth for rule compliance — unlike 'validate_plan' which is advisory. Returns rule statuses, blocking count, and the first 5 violations with file/line evidence. Use this after writing code, before committing, and inside a repair loop.`,
  {
    changed_files: z.array(z.string()).optional().describe("Files changed in this work unit (for diff-evidence checks). If omitted, file globs are applied to the entire repo."),
    branch: z.string().optional().describe("Current branch name (used by diff-evidence 'branch_matches' rules)."),
    allow_commands: z.boolean().optional().describe("Allow running 'command' and 'analyzer' checks that execute subprocesses (default: false). Only enable in trusted local contexts."),
  },
  async ({ changed_files, branch, allow_commands }) => {
    const result = await runDeterministicChecks({
      cwd: process.cwd(),
      ...(changed_files !== undefined ? { changedFiles: changed_files } : {}),
      ...(branch !== undefined ? { branch } : {}),
      ...(allow_commands !== undefined ? { allowCommands: allow_commands } : {}),
    })
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    }
  },
)

server.tool(
  "check_diff",
  `Run deterministic checks against only the files changed vs a base ref (default 'HEAD'). Auto-populates the changed file list via 'git diff --name-only base...HEAD'. Returns a no-op PASSED summary when the diff is empty. Use this in CI-style flows or after a series of edits to verify nothing regressed.`,
  {
    base: z.string().optional().describe("Base ref to diff against (default: HEAD). Use the merge-base of the feature branch for PR-style checks."),
    branch: z.string().optional().describe("Current branch name (for diff-evidence 'branch_matches' rules)."),
    staged: z.boolean().optional().describe("Use 'git diff --cached' (staged changes) instead of a ref-based diff."),
    allow_commands: z.boolean().optional().describe("Allow command/analyzer checks (default: false)."),
  },
  async ({ base, branch, staged, allow_commands }) => {
    const result = await checkDiff({
      cwd: process.cwd(),
      ...(base !== undefined ? { base } : {}),
      ...(branch !== undefined ? { branch } : {}),
      ...(staged !== undefined ? { staged } : {}),
      ...(allow_commands !== undefined ? { allowCommands: allow_commands } : {}),
    })
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    }
  },
)

server.tool(
  "get_repair_instructions",
  `Run deterministic checks and return a structured repair-loop payload: one entry per VIOLATED/ERROR result with rule_id, file, line, reason, suggested_fix, source, and a rerun_command the agent can run after applying the fix. Designed for an agent's automated repair loop.`,
  {
    changed_files: z.array(z.string()).optional().describe("Files changed in this work unit."),
    branch: z.string().optional().describe("Current branch name."),
    allow_commands: z.boolean().optional().describe("Allow command/analyzer checks (default: false)."),
    limit: z.number().int().positive().optional().describe("Maximum number of instructions to return (default: 20)."),
  },
  async ({ changed_files, branch, allow_commands, limit }) => {
    const result = await getRepairInstructions({
      cwd: process.cwd(),
      ...(changed_files !== undefined ? { changedFiles: changed_files } : {}),
      ...(branch !== undefined ? { branch } : {}),
      ...(allow_commands !== undefined ? { allowCommands: allow_commands } : {}),
      ...(limit !== undefined ? { limit } : {}),
    })
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    }
  },
)

async function runAstAnalysis(
  code: string,
  lang: string
): Promise<ReadonlyArray<{ readonly rule: string; readonly line?: number; readonly message: string; readonly severity: string }>> {
  try {
    const result = await analyzeWithBuiltins(code, lang as Parameters<typeof analyzeWithBuiltins>[1])
    return result.matches.map((match) => ({
      rule: match.queryId,
      line: match.location.startRow + 1,
      message: match.message,
      severity: match.severity,
    }))
  } catch {
    // Language not supported by tree-sitter, skip AST analysis
    return []
  }
}

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error("MCP server error:", err)
  process.exit(1)
})
