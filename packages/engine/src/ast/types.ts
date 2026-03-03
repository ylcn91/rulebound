import type Parser from "web-tree-sitter"

export type SupportedLanguage = "typescript" | "python" | "java" | "go" | "rust" | "javascript" | "c_sharp" | "cpp" | "ruby" | "bash"

export interface ASTQueryDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly language: SupportedLanguage | "*"
  readonly severity: "error" | "warning" | "info"
  readonly category: string
  readonly query: string
  readonly message: string
  readonly suggestedFix?: string
  readonly captureFilters?: Record<string, string | readonly string[]>
}

export interface ASTMatch {
  readonly queryId: string
  readonly queryName: string
  readonly message: string
  readonly severity: "error" | "warning" | "info"
  readonly suggestedFix?: string
  readonly location: {
    readonly startRow: number
    readonly startColumn: number
    readonly endRow: number
    readonly endColumn: number
  }
  readonly matchedText: string
  readonly capturedNodes: readonly ASTCapturedNode[]
}

export interface ASTCapturedNode {
  readonly name: string
  readonly type: string
  readonly text: string
  readonly startRow: number
  readonly startColumn: number
}

export interface ASTAnalysisResult {
  readonly language: SupportedLanguage
  readonly matches: readonly ASTMatch[]
  readonly parseErrors: number
  readonly nodeCount: number
  readonly parseTimeMs: number
  readonly queryTimeMs: number
}

export interface RuleASTConfig {
  readonly queries?: readonly string[]
  readonly builtins?: readonly string[]
}

export const LANGUAGE_WASM_MAP: Record<SupportedLanguage, string> = {
  typescript: "tree-sitter-typescript.wasm",
  javascript: "tree-sitter-javascript.wasm",
  python: "tree-sitter-python.wasm",
  java: "tree-sitter-java.wasm",
  go: "tree-sitter-go.wasm",
  rust: "tree-sitter-rust.wasm",
  c_sharp: "tree-sitter-c_sharp.wasm",
  cpp: "tree-sitter-cpp.wasm",
  ruby: "tree-sitter-ruby.wasm",
  bash: "tree-sitter-bash.wasm",
}

export const FILE_EXTENSION_MAP: Record<string, SupportedLanguage> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
  ".cs": "c_sharp",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".h": "cpp",
  ".hpp": "cpp",
  ".rb": "ruby",
  ".sh": "bash",
  ".bash": "bash",
}
