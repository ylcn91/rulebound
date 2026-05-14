// @rulebound/engine/internal — experimental / internal helpers.
//
// This entry point exposes implementation details that are NOT part of the
// stable public API. Anything exported from here may change or be removed in
// any minor release without a deprecation cycle. If you depend on these
// symbols, pin to an exact engine version.
//
// Stable consumers should import from "@rulebound/engine" instead.

// Matchers
export { KeywordMatcher } from "./matchers/keyword.js"
export { SemanticMatcher } from "./matchers/semantic.js"
export { LLMMatcher } from "./matchers/llm.js"
export { ValidationPipeline } from "./matchers/pipeline.js"

// AST internals
export { ASTMatcher } from "./ast/matcher.js"
export { createParser, loadLanguage } from "./ast/parser-manager.js"
export { getQueryById, getQueryIdsByCategory, listQueryIds } from "./ast/builtin-queries.js"
export { LANGUAGE_WASM_MAP, FILE_EXTENSION_MAP } from "./ast/types.js"
export type {
  SupportedLanguage,
  ASTQueryDefinition,
  ASTMatch,
  ASTCapturedNode,
  RuleASTConfig,
} from "./ast/types.js"

// Check parsing internals
export { parseChecksYaml, parseRuleChecks, extractFencedChecks } from "./checks/parse.js"
export { SECRET_PATTERNS } from "./checks/runners/regex.js"
export type {
  AstCheck,
  RegexCheck,
  FileExistsCheck,
  FileNotExistsCheck,
  DiffEvidenceCheck,
  ForbiddenImportCheck,
  CommandCheck,
  AnalyzerCheck,
  AgentProcessCheck,
} from "./checks/types.js"
