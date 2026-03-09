// Core validation
export { validate } from "./validate.js"
export {
  createBugfixSpec,
  parseBugfixPlan,
  parseBugfixSpecMarkdown,
  renderBugfixPlanTemplate,
  renderBugfixSpecMarkdown,
  slugifyBugfixTitle,
  validateBugfixPlan,
  validateBugfixSpec,
} from "./bugfix.js"
export type {
  BugCondition,
  BugfixPlan,
  BugfixSpec,
  BugfixSpecDraft,
  BugfixValidationIssue,
  BugfixValidationResult,
  Postcondition,
  PreservationScenario,
} from "./bugfix.js"

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

// Telemetry
export {
  recordValidationEvent,
  computeStats,
  loadGlobalEvents,
  loadProjectEvents,
} from "./telemetry.js"
export type { ValidationEvent, StatsReport, TelemetryStore } from "./telemetry.js"

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
