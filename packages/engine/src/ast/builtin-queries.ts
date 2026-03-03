import type { ASTQueryDefinition, SupportedLanguage } from "./types.js"

const TS_QUERIES: readonly ASTQueryDefinition[] = [
  {
    id: "ts-no-any",
    name: "No 'any' Type",
    description: "Disallow use of the 'any' type annotation",
    language: "typescript",
    severity: "error",
    category: "style",
    query: `(predefined_type) @type`,
    captureFilters: { type: "any" },
    message: "Use 'unknown' with type guards instead of 'any'",
    suggestedFix: "Replace 'any' with 'unknown' and add type narrowing",
  },
  {
    id: "ts-no-non-null-assertion",
    name: "No Non-Null Assertion",
    description: "Disallow the non-null assertion operator (!) in TypeScript",
    language: "typescript",
    severity: "warning",
    category: "style",
    query: `(non_null_expression) @expr`,
    message: "Avoid non-null assertion operator (!). Use proper null checks instead.",
    suggestedFix: "Add an explicit null check or use optional chaining",
  },
  {
    id: "ts-no-type-assertion",
    name: "No Unsafe Type Assertion",
    description: "Flag 'as' type assertions that bypass type safety",
    language: "typescript",
    severity: "warning",
    category: "style",
    query: `(as_expression) @expr`,
    message: "Type assertion found. Prefer type guards over 'as' casts.",
    suggestedFix: "Use a type predicate function or discriminated union instead",
  },
  {
    id: "ts-no-console-log",
    name: "No console.log",
    description: "Disallow console.log in production code",
    language: "typescript",
    severity: "warning",
    category: "style",
    query: `
      (call_expression
        function: (member_expression
          object: (identifier) @obj
          property: (property_identifier) @prop)
      ) @call
    `,
    captureFilters: { obj: "console", prop: "log" },
    message: "Remove console.log before committing. Use a structured logger.",
    suggestedFix: "Replace with a logger (e.g., winston, pino) or remove entirely",
  },
  {
    id: "ts-no-debugger",
    name: "No Debugger Statement",
    description: "Disallow debugger statements",
    language: "typescript",
    severity: "error",
    category: "style",
    query: `(debugger_statement) @stmt`,
    message: "Remove debugger statement before committing",
  },
  {
    id: "ts-empty-catch",
    name: "No Empty Catch Block",
    description: "Catch blocks must not be empty",
    language: "typescript",
    severity: "error",
    category: "style",
    query: `
      (catch_clause
        body: (statement_block) @body)
    `,
    captureFilters: { body: "{}" },
    message: "Empty catch block swallows errors silently",
    suggestedFix: "At minimum, log the error or re-throw it",
  },
  {
    id: "ts-no-eval",
    name: "No eval()",
    description: "Disallow use of eval()",
    language: "typescript",
    severity: "error",
    category: "security",
    query: `
      (call_expression
        function: (identifier) @fn) @call
    `,
    captureFilters: { fn: "eval" },
    message: "eval() is a security risk and should never be used",
    suggestedFix: "Use JSON.parse(), new Function(), or refactor logic",
  },
  {
    id: "ts-no-var",
    name: "No var Declaration",
    description: "Use const/let instead of var",
    language: "typescript",
    severity: "warning",
    category: "style",
    query: `(variable_declaration "var") @decl`,
    message: "Use 'const' or 'let' instead of 'var'",
    suggestedFix: "Replace 'var' with 'const' (preferred) or 'let'",
  },
  {
    id: "ts-no-nested-ternary",
    name: "No Nested Ternary",
    description: "Disallow nested ternary expressions",
    language: "typescript",
    severity: "warning",
    category: "style",
    query: `
      (ternary_expression
        consequence: (ternary_expression) @nested) @outer
    `,
    message: "Nested ternary is hard to read. Use if/else or switch.",
    suggestedFix: "Refactor to if/else or extract into a function",
  },
  {
    id: "ts-no-alert",
    name: "No alert()",
    description: "Disallow use of alert()",
    language: "typescript",
    severity: "warning",
    category: "style",
    query: `
      (call_expression
        function: (identifier) @fn) @call
    `,
    captureFilters: { fn: "alert" },
    message: "alert() should not be used in production code",
    suggestedFix: "Use a proper UI notification component",
  },
]

const JS_QUERIES: readonly ASTQueryDefinition[] = [
  ...TS_QUERIES.filter((q) =>
    !["ts-no-any", "ts-no-non-null-assertion", "ts-no-type-assertion"].includes(q.id)
  ).map((q) => ({ ...q, id: q.id.replace("ts-", "js-"), language: "javascript" as SupportedLanguage })),
]

const PYTHON_QUERIES: readonly ASTQueryDefinition[] = [
  {
    id: "py-bare-except",
    name: "No Bare Except",
    description: "Catch specific exceptions instead of bare except",
    language: "python",
    severity: "error",
    category: "style",
    query: `(except_clause) @clause`,
    message: "Bare 'except:' catches all exceptions including SystemExit and KeyboardInterrupt. Specify exception types.",
    suggestedFix: "Use 'except Exception as e:' at minimum",
  },
  {
    id: "py-no-print",
    name: "No print() in Production",
    description: "Use logging module instead of print()",
    language: "python",
    severity: "warning",
    category: "style",
    query: `
      (call
        function: (identifier) @fn) @call
    `,
    captureFilters: { fn: "print" },
    message: "Use the logging module instead of print()",
    suggestedFix: "Replace with logging.info() or logging.debug()",
  },
  {
    id: "py-no-pass-except",
    name: "No pass in Except",
    description: "Except blocks should not silently pass",
    language: "python",
    severity: "error",
    category: "style",
    query: `
      (except_clause
        (block (pass_statement) @pass_stmt)) @clause
    `,
    message: "Silent 'pass' in except block swallows errors",
    suggestedFix: "At minimum, log the error or re-raise it",
  },
  {
    id: "py-no-eval",
    name: "No eval()",
    description: "Disallow use of eval() for security reasons",
    language: "python",
    severity: "error",
    category: "security",
    query: `
      (call
        function: (identifier) @fn) @call
    `,
    captureFilters: { fn: "eval" },
    message: "eval() is a security risk",
    suggestedFix: "Use ast.literal_eval() for safe evaluation or refactor",
  },
  {
    id: "py-no-exec",
    name: "No exec()",
    description: "Disallow use of exec()",
    language: "python",
    severity: "error",
    category: "security",
    query: `
      (call
        function: (identifier) @fn) @call
    `,
    captureFilters: { fn: "exec" },
    message: "exec() executes arbitrary code and is a security risk",
  },
  {
    id: "py-no-star-import",
    name: "No Wildcard Import",
    description: "Disallow 'from module import *'",
    language: "python",
    severity: "warning",
    category: "style",
    query: `(import_from_statement (wildcard_import) @star) @import`,
    message: "Wildcard imports pollute the namespace",
    suggestedFix: "Import specific names explicitly",
  },
  {
    id: "py-mutable-default-arg",
    name: "No Mutable Default Arguments",
    description: "Default arguments should not be mutable objects",
    language: "python",
    severity: "error",
    category: "style",
    query: `
      (default_parameter
        value: [(list) (dictionary)] @default) @param
    `,
    message: "Mutable default argument. This is shared across all calls.",
    suggestedFix: "Use None as default and create the mutable object inside the function",
  },
]

const JAVA_QUERIES: readonly ASTQueryDefinition[] = [
  {
    id: "java-empty-catch",
    name: "No Empty Catch Block",
    description: "Catch blocks must handle or log exceptions",
    language: "java",
    severity: "error",
    category: "style",
    query: `
      (catch_clause
        body: (block) @body) @clause
    `,
    captureFilters: { body: "{}" },
    message: "Empty catch block swallows exception silently",
    suggestedFix: "Log the exception or re-throw it",
  },
  {
    id: "java-catch-throwable",
    name: "No catch(Throwable)",
    description: "Do not catch Throwable directly",
    language: "java",
    severity: "error",
    category: "style",
    query: `
      (catch_clause
        (catch_formal_parameter
          (catch_type (type_identifier) @type))) @clause
    `,
    captureFilters: { type: "Throwable" },
    message: "Catching Throwable includes Errors that shouldn't be caught",
    suggestedFix: "Catch specific exception types or Exception at most",
  },
  {
    id: "java-system-out",
    name: "No System.out.println",
    description: "Use a logger instead of System.out",
    language: "java",
    severity: "warning",
    category: "style",
    query: `
      (method_invocation
        object: (field_access
          object: (identifier) @sys
          field: (identifier) @out)
        name: (identifier) @method) @call
    `,
    captureFilters: { sys: "System", out: "out", method: "println" },
    message: "Use SLF4J/Log4j instead of System.out.println()",
    suggestedFix: "Replace with logger.info() or logger.debug()",
  },
  {
    id: "java-field-injection",
    name: "No Field Injection",
    description: "Use constructor injection instead of @Autowired on fields",
    language: "java",
    severity: "error",
    category: "architecture",
    query: `
      (field_declaration
        (modifiers
          (marker_annotation
            name: (identifier) @ann))) @field
    `,
    captureFilters: { ann: "Autowired" },
    message: "Use constructor injection instead of @Autowired on fields",
    suggestedFix: "Remove @Autowired, add field to constructor parameters",
  },
  {
    id: "java-thread-sleep",
    name: "No Thread.sleep in Production",
    description: "Thread.sleep is fragile, use proper concurrency primitives",
    language: "java",
    severity: "warning",
    category: "performance",
    query: `
      (method_invocation
        object: (identifier) @cls
        name: (identifier) @method) @call
    `,
    captureFilters: { cls: "Thread", method: "sleep" },
    message: "Avoid Thread.sleep(). Use ScheduledExecutorService or CountDownLatch.",
    suggestedFix: "Use java.util.concurrent primitives instead",
  },
]

const GO_QUERIES: readonly ASTQueryDefinition[] = [
  {
    id: "go-unchecked-error",
    name: "No Unchecked Errors",
    description: "Function calls that return error must check it",
    language: "go",
    severity: "error",
    category: "style",
    query: `
      (expression_statement
        (call_expression) @call)
    `,
    message: "Return value possibly discarded. If this returns an error, check it.",
    suggestedFix: "Assign to err and check: if err != nil { ... }",
  },
  {
    id: "go-fmt-println",
    name: "No fmt.Println in Production",
    description: "Use structured logging instead of fmt.Println",
    language: "go",
    severity: "warning",
    category: "style",
    query: `
      (call_expression
        function: (selector_expression
          operand: (identifier) @pkg
          field: (field_identifier) @fn)) @call
    `,
    captureFilters: { pkg: "fmt", fn: ["Println", "Printf", "Print"] },
    message: "Use a structured logger (slog, zap, zerolog) instead of fmt.Print*",
    suggestedFix: "Replace with slog.Info() or your project's logger",
  },
  {
    id: "go-panic",
    name: "No panic() in Libraries",
    description: "Libraries should return errors, not panic",
    language: "go",
    severity: "warning",
    category: "style",
    query: `
      (call_expression
        function: (identifier) @fn) @call
    `,
    captureFilters: { fn: "panic" },
    message: "Avoid panic() in library code. Return an error instead.",
    suggestedFix: "Return an error value instead of panicking",
  },
]

const RUST_QUERIES: readonly ASTQueryDefinition[] = [
  {
    id: "rust-unwrap",
    name: "No unwrap()",
    description: "Use proper error handling instead of unwrap()",
    language: "rust",
    severity: "warning",
    category: "style",
    query: `
      (call_expression
        function: (field_expression
          field: (field_identifier) @method)) @call
    `,
    captureFilters: { method: "unwrap" },
    message: "unwrap() will panic on None/Err. Use ? operator or match.",
    suggestedFix: "Use the ? operator, unwrap_or(), or pattern matching",
  },
  {
    id: "rust-expect-no-message",
    name: "No Bare expect()",
    description: "expect() should have a descriptive message",
    language: "rust",
    severity: "info",
    category: "style",
    query: `
      (call_expression
        function: (field_expression
          field: (field_identifier) @method)) @call
    `,
    captureFilters: { method: "expect" },
    message: "Consider using ? operator instead of expect() for proper error propagation",
    suggestedFix: "Replace with ? operator or map_err() for better error context",
  },
  {
    id: "rust-println",
    name: "No println! in Libraries",
    description: "Libraries should use log/tracing, not println!",
    language: "rust",
    severity: "warning",
    category: "style",
    query: `
      (macro_invocation
        macro: (identifier) @name) @call
    `,
    captureFilters: { name: ["println", "print", "dbg"] },
    message: "Use log/tracing crate macros instead of println!/print!/dbg!",
    suggestedFix: "Replace with tracing::info!() or log::info!()",
  },
  {
    id: "rust-todo",
    name: "No todo!() Remaining",
    description: "Remove todo!() macros before shipping",
    language: "rust",
    severity: "error",
    category: "style",
    query: `
      (macro_invocation
        macro: (identifier) @name) @call
    `,
    captureFilters: { name: "todo" },
    message: "todo!() macro will panic at runtime. Implement before shipping.",
  },
]

const ALL_QUERIES: readonly ASTQueryDefinition[] = [
  ...TS_QUERIES,
  ...JS_QUERIES,
  ...PYTHON_QUERIES,
  ...JAVA_QUERIES,
  ...GO_QUERIES,
  ...RUST_QUERIES,
]

export function getBuiltinQueries(language?: SupportedLanguage): readonly ASTQueryDefinition[] {
  if (!language) return ALL_QUERIES
  return ALL_QUERIES.filter((q) => q.language === language || q.language === "*")
}

export function getQueryById(id: string): ASTQueryDefinition | undefined {
  return ALL_QUERIES.find((q) => q.id === id)
}

export function getQueryIdsByCategory(category: string): readonly string[] {
  return ALL_QUERIES.filter((q) => q.category === category).map((q) => q.id)
}

export function listQueryIds(language?: SupportedLanguage): readonly string[] {
  return getBuiltinQueries(language).map((q) => q.id)
}

export { TS_QUERIES, JS_QUERIES, PYTHON_QUERIES, JAVA_QUERIES, GO_QUERIES, RUST_QUERIES }
