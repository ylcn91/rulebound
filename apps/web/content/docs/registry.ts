export interface DocPage {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly content: string
}

export interface NavItem {
  readonly title: string
  readonly slug: string
}

export interface NavSection {
  readonly title: string
  readonly items: readonly NavItem[]
}

export const navigation: readonly NavSection[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", slug: "getting-started/introduction" },
      { title: "Quick Start", slug: "getting-started/quick-start" },
      { title: "Installation", slug: "getting-started/installation" },
      { title: "Configuration", slug: "getting-started/configuration" },
      { title: "Project Structure", slug: "getting-started/project-structure" },
    ],
  },
  {
    title: "Rules",
    items: [
      { title: "Overview", slug: "rules/overview" },
      { title: "Rule Format", slug: "rules/rule-format" },
      { title: "Glob Patterns", slug: "rules/glob-patterns" },
      { title: "Severity Levels", slug: "rules/severity-levels" },
      { title: "Rule Inheritance", slug: "rules/rule-inheritance" },
      { title: "Custom Rules", slug: "rules/custom-rules" },
    ],
  },
  {
    title: "CLI",
    items: [
      { title: "Overview", slug: "cli/overview" },
      { title: "Init", slug: "cli/init" },
      { title: "Scan", slug: "cli/scan" },
      { title: "Watch", slug: "cli/watch" },
      { title: "Report", slug: "cli/report" },
    ],
  },
  {
    title: "Enforcement",
    items: [
      { title: "Overview", slug: "enforcement/overview" },
      { title: "Pre-Commit Hooks", slug: "enforcement/pre-commit-hooks" },
      { title: "CI/CD Integration", slug: "enforcement/ci-cd" },
      { title: "Editor Integration", slug: "enforcement/editor-integration" },
      { title: "GitHub Actions", slug: "enforcement/github-actions" },
      { title: "Fail Modes", slug: "enforcement/fail-modes" },
    ],
  },
  {
    title: "Gateway",
    items: [
      { title: "Overview", slug: "gateway/overview" },
      { title: "Request Scanning", slug: "gateway/request-scanning" },
      { title: "Response Scanning", slug: "gateway/response-scanning" },
      { title: "AST Analysis", slug: "gateway/ast-analysis" },
      { title: "Middleware", slug: "gateway/middleware" },
      { title: "Rate Limiting", slug: "gateway/rate-limiting" },
    ],
  },
  {
    title: "LSP Server",
    items: [
      { title: "Overview", slug: "lsp/overview" },
      { title: "Diagnostics", slug: "lsp/diagnostics" },
      { title: "Editor Setup", slug: "lsp/editor-setup" },
    ],
  },
  {
    title: "MCP Server",
    items: [
      { title: "Overview", slug: "mcp/overview" },
      { title: "Pre-Write Tool", slug: "mcp/pre-write-tool" },
      { title: "Configuration", slug: "mcp/configuration" },
    ],
  },
  {
    title: "AST Engine",
    items: [
      { title: "Overview", slug: "ast/overview" },
      { title: "Pattern Matching", slug: "ast/pattern-matching" },
      { title: "Supported Languages", slug: "ast/supported-languages" },
    ],
  },
  {
    title: "Server & API",
    items: [
      { title: "Overview", slug: "server/overview" },
      { title: "REST API", slug: "server/rest-api" },
      { title: "Authentication", slug: "server/authentication" },
      { title: "Webhooks", slug: "server/webhooks" },
    ],
  },
  {
    title: "SDKs",
    items: [
      { title: "JavaScript SDK", slug: "sdk/javascript" },
      { title: "TypeScript Types", slug: "sdk/typescript-types" },
    ],
  },
  {
    title: "Deployment",
    items: [
      { title: "Self-Hosted", slug: "deployment/self-hosted" },
      { title: "Docker", slug: "deployment/docker" },
      { title: "Environment Variables", slug: "deployment/environment-variables" },
    ],
  },
] as const

const slugToModulePath: Record<string, () => Promise<{ default: DocPage }>> = {}

function buildSlugMap() {
  for (const section of navigation) {
    for (const item of section.items) {
      slugToModulePath[item.slug] = () =>
        import(`@/content/docs/${item.slug}`) as Promise<{ default: DocPage }>
    }
  }
}

buildSlugMap()

export function getAllSlugs(): string[][] {
  return navigation.flatMap((section) =>
    section.items.map((item) => item.slug.split("/"))
  )
}

export async function getDoc(slug: string): Promise<DocPage | null> {
  const loader = slugToModulePath[slug]
  if (!loader) return null
  try {
    const mod = await loader()
    return mod.default
  } catch {
    return null
  }
}
