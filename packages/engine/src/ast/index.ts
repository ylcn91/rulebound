export { ASTMatcher } from "./matcher.js"
export { analyzeCode, analyzeWithBuiltins } from "./analyzer.js"
export { createParser, loadLanguage, detectLanguageFromPath, isSupportedLanguage } from "./parser-manager.js"
export {
  getBuiltinQueries,
  getQueryById,
  getQueryIdsByCategory,
  listQueryIds,
  TS_QUERIES,
  JS_QUERIES,
  PYTHON_QUERIES,
  JAVA_QUERIES,
  GO_QUERIES,
  RUST_QUERIES,
} from "./builtin-queries.js"
export type {
  SupportedLanguage,
  ASTQueryDefinition,
  ASTMatch,
  ASTCapturedNode,
  ASTAnalysisResult,
  RuleASTConfig,
} from "./types.js"
export { LANGUAGE_WASM_MAP, FILE_EXTENSION_MAP } from "./types.js"
