#!/usr/bin/env node

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  type InitializeParams,
  type InitializeResult,
  type Diagnostic,
} from "vscode-languageserver/node.js"
import { TextDocument } from "vscode-languageserver-textdocument"
import {
  analyzeWithBuiltins,
  detectLanguageFromPath,
  isSupportedLanguage,
  findRulesDir,
  loadLocalRules,
  validate,
} from "@rulebound/engine"
import type { Rule } from "@rulebound/engine"
import { SERVER_CAPABILITIES } from "./capabilities.js"
import {
  matchToDiagnostic,
  validationResultToDiagnostic,
} from "./diagnostics.js"

const DEBOUNCE_DELAY_MS = 300

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)
const debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

let workspaceRules: readonly Rule[] = []

function uriToFilePath(uri: string): string {
  return uri.startsWith("file://") ? new URL(uri).pathname : uri
}

function loadWorkspaceRules(
  folderPaths: readonly string[]
): readonly Rule[] {
  const allRules: Rule[] = []

  for (const folder of folderPaths) {
    const rulesDir = findRulesDir(folder)
    if (rulesDir) {
      try {
        const rules = loadLocalRules(rulesDir)
        allRules.push(...rules)
      } catch {
        // Rules dir exists but failed to load — continue without rules
      }
    }
  }

  return allRules
}

async function analyzeDocument(
  uri: string,
  text: string
): Promise<readonly Diagnostic[]> {
  const filePath = uriToFilePath(uri)
  const detected = detectLanguageFromPath(filePath)

  if (!detected || !isSupportedLanguage(detected)) {
    return []
  }

  const diagnostics: Diagnostic[] = []

  try {
    const result = await analyzeWithBuiltins(text, detected)
    const astDiagnostics = result.matches.map(matchToDiagnostic)
    diagnostics.push(...astDiagnostics)
  } catch {
    // AST analysis failed — return empty diagnostics for this pass
  }

  if (workspaceRules.length > 0) {
    try {
      const report = await validate({ plan: text, rules: workspaceRules })
      const violated = report.results.filter((r) => r.status === "VIOLATED")
      const ruleDiagnostics = violated.map(validationResultToDiagnostic)
      diagnostics.push(...ruleDiagnostics)
    } catch {
      // Validation failed — continue with AST-only diagnostics
    }
  }

  return diagnostics
}

function publishDiagnostics(
  uri: string,
  diagnostics: readonly Diagnostic[]
): void {
  connection.sendDiagnostics({
    uri,
    diagnostics: [...diagnostics],
  })
}

async function runAnalysisAndPublish(
  uri: string,
  text: string
): Promise<void> {
  const diagnostics = await analyzeDocument(uri, text)
  publishDiagnostics(uri, diagnostics)
}

function clearDebounceTimer(uri: string): void {
  const existing = debounceTimers.get(uri)
  if (existing) {
    clearTimeout(existing)
    debounceTimers.delete(uri)
  }
}

function scheduleDebouncedAnalysis(uri: string, text: string): void {
  clearDebounceTimer(uri)

  const timer = setTimeout(() => {
    debounceTimers.delete(uri)
    void runAnalysisAndPublish(uri, text)
  }, DEBOUNCE_DELAY_MS)

  debounceTimers.set(uri, timer)
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const folders = params.workspaceFolders ?? []
  const folderPaths = folders.map((f) => uriToFilePath(f.uri))
  workspaceRules = loadWorkspaceRules(folderPaths)

  return { capabilities: SERVER_CAPABILITIES }
})

documents.onDidOpen((event) => {
  void runAnalysisAndPublish(event.document.uri, event.document.getText())
})

documents.onDidChangeContent((event) => {
  scheduleDebouncedAnalysis(event.document.uri, event.document.getText())
})

documents.onDidSave((event) => {
  clearDebounceTimer(event.document.uri)
  void runAnalysisAndPublish(event.document.uri, event.document.getText())
})

documents.listen(connection)
connection.listen()
