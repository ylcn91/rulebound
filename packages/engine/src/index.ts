// Core validation
export { validate } from "./validate.js"

// Rule loading
export {
  findRulesDir,
  loadLocalRules,
  matchRulesByContext,
  filterRules,
  detectProjectStack,
  detectLanguageFromCode,
  loadConfig,
  getProjectConfig,
  loadRulesWithInheritance,
} from "./rule-loader.js"

// Enforcement
export {
  DEFAULT_ENFORCEMENT,
  shouldBlock,
  shouldWarn,
  shouldSuggestPromotion,
  calculateScore,
  isValidMode,
} from "./enforcement.js"

// Matchers
export { KeywordMatcher } from "./matchers/keyword.js"
export { SemanticMatcher } from "./matchers/semantic.js"
export { ValidationPipeline } from "./matchers/pipeline.js"

// LLM matcher (dynamic import recommended)
export { LLMMatcher } from "./matchers/llm.js"

// AST analysis (web-tree-sitter)
export { ASTMatcher } from "./ast/matcher.js"
export { analyzeCode, analyzeWithBuiltins } from "./ast/analyzer.js"
export { createParser, loadLanguage, detectLanguageFromPath, isSupportedLanguage } from "./ast/parser-manager.js"
export {
  getBuiltinQueries,
  getQueryById,
  getQueryIdsByCategory,
  listQueryIds,
} from "./ast/builtin-queries.js"
export { LANGUAGE_WASM_MAP, FILE_EXTENSION_MAP } from "./ast/types.js"

// AST Types
export type {
  SupportedLanguage,
  ASTQueryDefinition,
  ASTMatch,
  ASTCapturedNode,
  ASTAnalysisResult,
  RuleASTConfig,
} from "./ast/types.js"

// Types
export type {
  Rule,
  RuleSeverity,
  RuleCategory,
  RuleModality,
  MatchStatus,
  MatchResult,
  MatcherContext,
  Matcher,
  PipelineResult,
  EnforcementMode,
  EnforcementConfig,
  ValidationResult,
  ValidationReport,
  ProjectConfig,
  ValidateOptions,
  BlockCheckInput,
  LLMConfig,
  RuleboundConfig,
} from "./types.js"
