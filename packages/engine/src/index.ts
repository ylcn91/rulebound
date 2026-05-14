// @rulebound/engine — stable public API.
//
// Symbols exported from this barrel are part of the supported surface.
// Implementation details that are NOT considered stable live in
// "@rulebound/engine/internal". For backwards compatibility, those internals
// are also re-exported from the bottom of this file with `@deprecated` markers
// during the v0.2.x line; they will be removed from the main barrel in v0.3.0.

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
  shouldBlockDeterministic,
  shouldWarn,
  shouldSuggestPromotion,
  calculateScore,
  isValidMode,
} from "./enforcement.js"
export type { DeterministicBlockInput } from "./enforcement.js"

// AST analysis (web-tree-sitter) — stable, externally consumed surface
export { analyzeCode, analyzeWithBuiltins } from "./ast/analyzer.js"
export { detectLanguageFromPath, isSupportedLanguage } from "./ast/parser-manager.js"
export { getBuiltinQueries } from "./ast/builtin-queries.js"
export type { ASTAnalysisResult } from "./ast/types.js"

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

// Deterministic checks
export { validateDeterministic } from "./checks/deterministic.js"
export type {
  DeterministicValidateOptions,
  DeterministicReport,
  RuleStatus,
  AgentSignals,
} from "./checks/deterministic.js"
// Canonical DeterministicReport schema (re-exports + runtime guard)
export { SCHEMA_VERSION, validateDeterministicReport } from "./report-schema.js"
export type { ReportParseError } from "./report-schema.js"
export type {
  RuleCheck,
  CheckResult,
  CheckEvidence,
  DeterministicSource,
  ConfidenceLevel,
} from "./checks/types.js"
export { loadWaivers, loadWaiversWithErrors, applyWaivers } from "./checks/waivers.js"
export type {
  Waiver,
  AppliedWaiver,
  WaiverApplication,
  WaiverLoadError,
  WaiverLoadResult,
} from "./checks/waivers.js"

// ---------------------------------------------------------------------------
// Soft-deprecated re-exports — internal helpers.
//
// The following symbols are implementation details. They remain re-exported
// from the main barrel for one minor release to give consumers a migration
// window, and will be REMOVED from `@rulebound/engine` in v0.3.0. Import them
// from `@rulebound/engine/internal` instead.
// ---------------------------------------------------------------------------

/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export { KeywordMatcher } from "./matchers/keyword.js"
/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export { SemanticMatcher } from "./matchers/semantic.js"
/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export { ValidationPipeline } from "./matchers/pipeline.js"
/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export { LLMMatcher } from "./matchers/llm.js"

/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export { ASTMatcher } from "./ast/matcher.js"
/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export { createParser, loadLanguage } from "./ast/parser-manager.js"
/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export { getQueryById, getQueryIdsByCategory, listQueryIds } from "./ast/builtin-queries.js"
/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export { LANGUAGE_WASM_MAP, FILE_EXTENSION_MAP } from "./ast/types.js"
/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export type {
  SupportedLanguage,
  ASTQueryDefinition,
  ASTMatch,
  ASTCapturedNode,
  RuleASTConfig,
} from "./ast/types.js"

/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export { parseChecksYaml, parseRuleChecks, extractFencedChecks } from "./checks/parse.js"
/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
export { SECRET_PATTERNS } from "./checks/runners/regex.js"
/** @deprecated Import from "@rulebound/engine/internal" instead. Scheduled for removal in v0.3.0. */
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
