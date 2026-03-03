import type { Matcher, MatcherContext, MatchResult } from "../types.js"
import { analyzeCode } from "./analyzer.js"
import { getBuiltinQueries, getQueryById } from "./builtin-queries.js"
import { isSupportedLanguage } from "./parser-manager.js"
import type { SupportedLanguage, ASTQueryDefinition, RuleASTConfig } from "./types.js"
import { logger } from "@rulebound/shared/logger"

function detectLanguageFromContent(plan: string): SupportedLanguage | null {
  const patterns: [RegExp, SupportedLanguage][] = [
    [/\b(?:import|export)\s+(?:type\s+)?[{*].*from\s+['"]|:\s*(?:string|number|boolean|Record<|Promise<)/, "typescript"],
    [/\bfn\s+\w+\s*\(.*\)\s*(?:->|\{)|let\s+mut\s+|impl\s+\w+\s+for/, "rust"],
    [/\bfunc\s+\w+\s*\(.*\)\s*(?:\w+\s*)?{|package\s+\w+\nimport/, "go"],
    [/\bdef\s+\w+\s*\(.*\)\s*(?:->.*)?:|import\s+\w+|from\s+\w+\s+import/, "python"],
    [/\bpublic\s+(?:class|interface|enum)\s+\w+|@(?:Override|Component|Service|Bean)/, "java"],
    [/\bfunction\s+\w+\s*\(|const\s+\w+\s*=\s*(?:function|\()/, "javascript"],
  ]

  for (const [pattern, lang] of patterns) {
    if (pattern.test(plan)) return lang
  }

  return null
}

function extractCodeBlocks(text: string): { code: string; language: SupportedLanguage | null }[] {
  const blocks: { code: string; language: SupportedLanguage | null }[] = []
  const regex = /```(\w+)?\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const langHint = match[1]?.toLowerCase()
    let language: SupportedLanguage | null = null

    if (langHint && isSupportedLanguage(langHint)) {
      language = langHint
    } else if (langHint === "ts" || langHint === "tsx") {
      language = "typescript"
    } else if (langHint === "js" || langHint === "jsx") {
      language = "javascript"
    } else if (langHint === "py") {
      language = "python"
    } else if (langHint === "rs") {
      language = "rust"
    } else if (langHint === "cs" || langHint === "csharp") {
      language = "c_sharp"
    }

    blocks.push({ code: match[2], language })
  }

  return blocks
}

function parseRuleASTConfig(rule: { content: string }): RuleASTConfig | null {
  const astMatch = rule.content.match(/<!--\s*ast:\s*([\s\S]*?)-->/)
  if (!astMatch) return null

  const config: { queries?: string[]; builtins?: string[] } = {}
  const lines = astMatch[1].split("\n")

  for (const line of lines) {
    const kv = line.match(/^\s*(queries|builtins):\s*\[([^\]]*)\]/)
    if (!kv) continue
    const values = kv[2].split(",").map((v) => v.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
    if (kv[1] === "queries") config.queries = values
    if (kv[1] === "builtins") config.builtins = values
  }

  return config.queries || config.builtins ? config : null
}

export class ASTMatcher implements Matcher {
  readonly name = "ast"

  private readonly forcedLanguage?: SupportedLanguage
  private readonly enabledQueryIds?: readonly string[]

  constructor(options?: { language?: SupportedLanguage; queryIds?: readonly string[] }) {
    this.forcedLanguage = options?.language
    this.enabledQueryIds = options?.queryIds
  }

  async match(context: MatcherContext): Promise<readonly MatchResult[]> {
    const { plan, rules } = context
    const results: MatchResult[] = []

    const codeBlocks = extractCodeBlocks(plan)
    const rawLanguage = this.forcedLanguage ?? detectLanguageFromContent(plan)

    if (codeBlocks.length === 0 && rawLanguage) {
      codeBlocks.push({ code: plan, language: rawLanguage })
    }

    if (codeBlocks.length === 0) {
      return rules.map((rule) => ({
        ruleId: rule.id,
        status: "NOT_COVERED" as const,
        confidence: 0.1,
        reason: "No parseable code found for AST analysis",
      }))
    }

    for (const rule of rules) {
      const astConfig = parseRuleASTConfig(rule)
      let ruleQueries: ASTQueryDefinition[] = []

      if (astConfig?.builtins) {
        ruleQueries = astConfig.builtins
          .map((id) => getQueryById(id))
          .filter((q): q is ASTQueryDefinition => q !== undefined)
      }

      if (astConfig?.queries) {
        for (let i = 0; i < astConfig.queries.length; i++) {
          ruleQueries.push({
            id: `${rule.id}-custom-${i}`,
            name: `Custom query for ${rule.title}`,
            description: rule.title,
            language: "*",
            severity: (rule.severity as "error" | "warning" | "info") ?? "warning",
            category: rule.category,
            query: astConfig.queries[i],
            message: `Violation of "${rule.title}"`,
            suggestedFix: undefined,
          })
        }
      }

      let foundViolation = false
      let totalASTMatches = 0

      for (const block of codeBlocks) {
        const lang = block.language ?? rawLanguage
        if (!lang || !isSupportedLanguage(lang)) continue

        const queries = ruleQueries.length > 0
          ? ruleQueries.filter((q) => q.language === lang || q.language === "*")
          : this.getDefaultQueries(lang, rule)

        if (queries.length === 0) continue

        try {
          const analysis = await analyzeCode(block.code, lang, queries)
          totalASTMatches += analysis.matches.length

          if (analysis.matches.length > 0) {
            foundViolation = true
            const firstMatch = analysis.matches[0]
            results.push({
              ruleId: rule.id,
              status: "VIOLATED",
              confidence: 0.9,
              reason: `AST: ${firstMatch.message} (L${firstMatch.location.startRow + 1}:${firstMatch.location.startColumn + 1}). ${analysis.matches.length} occurrence(s) found.`,
              suggestedFix: firstMatch.suggestedFix,
            })
          }
        } catch (error) {
          logger.debug("AST analysis skipped: language not loaded or query invalid", {
            language: lang,
            ruleId: rule.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      if (!foundViolation) {
        results.push({
          ruleId: rule.id,
          status: totalASTMatches === 0 ? "PASS" : "PASS",
          confidence: 0.5,
          reason: "No AST-level violations detected",
        })
      }
    }

    return results
  }

  private getDefaultQueries(lang: SupportedLanguage, rule: { category: string; tags: readonly string[] }): ASTQueryDefinition[] {
    let queries = getBuiltinQueries(lang)

    if (this.enabledQueryIds) {
      queries = queries.filter((q) => this.enabledQueryIds!.includes(q.id))
    }

    const ruleKeywords = [...rule.tags, rule.category].map((t) => t.toLowerCase())
    const categoryMatch = queries.filter((q) =>
      q.category === rule.category ||
      ruleKeywords.some((kw) => q.id.includes(kw) || q.name.toLowerCase().includes(kw))
    )

    return categoryMatch.length > 0 ? [...categoryMatch] : [...queries]
  }
}
