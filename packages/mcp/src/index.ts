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

const server = new McpServer({
  name: "rulebound",
  version: "0.1.0",
})

// Auto-detect project stack once at startup
const projectStack = detectProjectStack(process.cwd())

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
  `Validate an implementation plan against project rules. MUST be called before writing any code. If violations are found, adjust your plan before proceeding.`,
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

    const semanticViolations = report
      ? report.results
          .filter((r) => r.status === "VIOLATED")
          .map((r) => ({
            rule: r.ruleId,
            message: r.reason,
            severity: r.severity,
            fix: r.suggestedFix,
          }))
      : []

    const violations = [
      ...astViolations.map((v) => ({ ...v, source: "ast" as const })),
      ...semanticViolations.map((v) => ({ ...v, source: "semantic" as const })),
    ]

    const approved = violations.length === 0
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          approved,
          file_path,
          language: lang ?? "unknown",
          violations,
          message: approved
            ? "Code is clean — safe to write"
            : `${violations.length} violation(s) found — review before writing`,
        }, null, 2),
      }],
    }
  }
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
