# @rulebound/engine

Core validation engine for Rulebound — rule loading, deterministic check execution, matchers, and enforcement. This package is consumed by `@rulebound/cli`, `@rulebound/gateway`, and `@rulebound/mcp`. Direct use from application code is supported but most users should prefer the CLI.

## Public API surface

The engine ships two entry points:

- `@rulebound/engine` — **stable public API**. Validation entry points (`validate`, `validateDeterministic`), rule loading, enforcement helpers, waivers, telemetry, the canonical `DeterministicReport` schema, and the small set of AST helpers consumed by external tooling (`analyzeCode`, `analyzeWithBuiltins`, `getBuiltinQueries`, `isSupportedLanguage`, `detectLanguageFromPath`). Symbols here follow semver: breaking changes require a major bump.
- `@rulebound/engine/internal` — **experimental / implementation details**. Matcher classes (`KeywordMatcher`, `SemanticMatcher`, `LLMMatcher`, `ValidationPipeline`), low-level AST plumbing (`ASTMatcher`, `createParser`, `loadLanguage`, query registry helpers, language maps), and check-parsing internals (`parseChecksYaml`, `parseRuleChecks`, `extractFencedChecks`, `SECRET_PATTERNS`, and the per-check type aliases). These symbols may change or be removed in any minor release.

### Soft-deprecation window

The internal symbols listed above are currently still re-exported from the main `@rulebound/engine` barrel for backwards compatibility, but each one is annotated with a `@deprecated` JSDoc tag pointing at `@rulebound/engine/internal`. They will be **removed from the main barrel in v0.3.0**. If you import any of them from `@rulebound/engine`, switch the import to `@rulebound/engine/internal` before upgrading.
