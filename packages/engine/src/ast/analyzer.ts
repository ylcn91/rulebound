import { createParser, loadLanguage } from "./parser-manager.js"
import { getBuiltinQueries, getQueryById } from "./builtin-queries.js"
import type Parser from "web-tree-sitter"
import { logger } from "@rulebound/shared/logger"
import type {
  SupportedLanguage,
  ASTQueryDefinition,
  ASTMatch,
  ASTCapturedNode,
  ASTAnalysisResult,
} from "./types.js"

export async function analyzeCode(
  code: string,
  language: SupportedLanguage,
  queries?: readonly ASTQueryDefinition[]
): Promise<ASTAnalysisResult> {
  const parseStart = performance.now()
  const parser = await createParser(language)
  const tree = parser.parse(code)
  const parseTimeMs = Math.round(performance.now() - parseStart)

  if (!tree) {
    parser.delete()
    return { language, matches: [], parseErrors: 0, nodeCount: 0, parseTimeMs, queryTimeMs: 0 }
  }

  const root = tree.rootNode
  const nodeCount = root.descendantCount
  const parseErrors = countErrors(root)

  const activeQueries = queries ?? getBuiltinQueries(language)
  const lang = await loadLanguage(language)
  const queryStart = performance.now()
  const matches = runQueries(root, language, activeQueries, lang)
  const queryTimeMs = Math.round(performance.now() - queryStart)

  tree.delete()
  parser.delete()

  return { language, matches, parseErrors, nodeCount, parseTimeMs, queryTimeMs }
}

function countErrors(node: Parser.SyntaxNode): number {
  let errors = 0
  const cursor = node.walk()
  let reachedRoot = false

  while (!reachedRoot) {
    if (cursor.currentNode.isError || cursor.currentNode.isMissing) {
      errors++
    }

    if (cursor.gotoFirstChild()) continue
    if (cursor.gotoNextSibling()) continue

    let found = false
    while (cursor.gotoParent()) {
      if (cursor.gotoNextSibling()) {
        found = true
        break
      }
    }
    if (!found) reachedRoot = true
  }

  cursor.delete()
  return errors
}

function matchesCaptureFilters(
  captures: Parser.QueryCapture[],
  filters: Record<string, string | readonly string[]> | undefined
): boolean {
  if (!filters) return true

  for (const [captureName, expected] of Object.entries(filters)) {
    const capture = captures.find((c: Parser.QueryCapture) => c.name === captureName)
    if (!capture) return false

    const text = capture.node.text
    if (Array.isArray(expected)) {
      if (!expected.includes(text)) return false
    } else {
      if (text !== expected) return false
    }
  }

  return true
}

function runQueries(
  root: Parser.SyntaxNode,
  language: SupportedLanguage,
  queryDefs: readonly ASTQueryDefinition[],
  langObj: Parser.Language
): readonly ASTMatch[] {
  const matches: ASTMatch[] = []

  for (const def of queryDefs) {
    if (def.language !== language && def.language !== "*") continue

    try {
      const query = langObj.query(def.query)
      const qMatches = query.matches(root)

      for (const match of qMatches) {
        if (!matchesCaptureFilters(match.captures, def.captureFilters)) continue

        const primaryCapture = match.captures[0]
        if (!primaryCapture) continue

        const node = primaryCapture.node
        const captured: ASTCapturedNode[] = match.captures.map((c: Parser.QueryCapture) => ({
          name: c.name,
          type: c.node.type,
          text: c.node.text.slice(0, 200),
          startRow: c.node.startPosition.row,
          startColumn: c.node.startPosition.column,
        }))

        matches.push({
          queryId: def.id,
          queryName: def.name,
          message: def.message,
          severity: def.severity,
          suggestedFix: def.suggestedFix,
          location: {
            startRow: node.startPosition.row,
            startColumn: node.startPosition.column,
            endRow: node.endPosition.row,
            endColumn: node.endPosition.column,
          },
          matchedText: node.text.slice(0, 200),
          capturedNodes: captured,
        })
      }

      query.delete()
    } catch (error) {
      logger.debug("Query syntax not supported for this language, skipping", {
        queryId: def.id,
        language,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return matches
}

export async function analyzeWithBuiltins(
  code: string,
  language: SupportedLanguage,
  builtinIds?: readonly string[]
): Promise<ASTAnalysisResult> {
  let queries: readonly ASTQueryDefinition[]

  if (builtinIds && builtinIds.length > 0) {
    queries = builtinIds
      .map((id) => getQueryById(id))
      .filter((q): q is ASTQueryDefinition => q !== undefined)
  } else {
    queries = getBuiltinQueries(language)
  }

  return analyzeCode(code, language, queries)
}
