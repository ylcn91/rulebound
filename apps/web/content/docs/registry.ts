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
    title: "CLI",
    items: [
      { title: "Overview", slug: "cli/overview" },
      { title: "rulebound init", slug: "cli/init" },
      { title: "rulebound check", slug: "cli/check" },
      { title: "rulebound heal", slug: "cli/heal" },
      { title: "rulebound doctor", slug: "cli/doctor" },
      { title: "rulebound evidence", slug: "cli/evidence" },
      { title: "rulebound advise", slug: "cli/advise" },
      { title: "rulebound packs", slug: "cli/packs" },
      { title: "rulebound watch", slug: "cli/watch" },
      { title: "rulebound report", slug: "cli/report" },
    ],
  },
  {
    title: "Rules",
    items: [
      { title: "Overview", slug: "rules/overview" },
      { title: "Rule Format", slug: "rules/rule-format" },
      { title: "Deterministic Checks", slug: "rules/deterministic-checks" },
      { title: "Report Schema", slug: "rules/report-schema" },
      { title: "Waivers", slug: "rules/waivers" },
      { title: "Glob Patterns", slug: "rules/glob-patterns" },
      { title: "Severity Levels", slug: "rules/severity-levels" },
      { title: "Custom Rules", slug: "rules/custom-rules" },
    ],
  },
  {
    title: "Workflows",
    items: [
      { title: "Bugfix Workflow", slug: "workflows/bugfix-workflow" },
      { title: "Self-Healing Loop", slug: "workflows/self-healing" },
      { title: "Scenario Evidence", slug: "workflows/scenario-evidence" },
    ],
  },
  {
    title: "MCP Server",
    items: [
      { title: "Overview", slug: "mcp/overview" },
      { title: "Setup", slug: "mcp/setup" },
      { title: "Deterministic Tools", slug: "mcp/deterministic-tools" },
      { title: "Configuration", slug: "mcp/configuration" },
    ],
  },
  {
    title: "CI / CD",
    items: [
      { title: "GitHub Action", slug: "ci/github-action" },
      { title: "Release Gate", slug: "ci/release-gate" },
      { title: "Pre-Commit Hooks", slug: "ci/pre-commit-hooks" },
      { title: "Fail Modes", slug: "ci/fail-modes" },
    ],
  },
  {
    title: "Analyzer Recipes",
    items: [
      { title: "Orchestration", slug: "recipes/orchestration" },
      { title: "Java Pack", slug: "recipes/java-pack" },
      { title: "Checkstyle", slug: "recipes/checkstyle" },
      { title: "ESLint", slug: "recipes/eslint" },
      { title: "gitleaks", slug: "recipes/gitleaks" },
      { title: "JUnit", slug: "recipes/junit" },
      { title: "PMD", slug: "recipes/pmd" },
      { title: "Semgrep", slug: "recipes/semgrep" },
      { title: "SpotBugs", slug: "recipes/spotbugs" },
      { title: "TypeScript tsc", slug: "recipes/typescript-tsc" },
    ],
  },
  {
    title: "Comparisons",
    items: [
      { title: "vs CodeRabbit", slug: "comparisons/coderabbit" },
      { title: "vs SonarQube", slug: "comparisons/sonarqube" },
    ],
  },
  {
    title: "Gateway (optional)",
    items: [
      { title: "Overview", slug: "gateway/overview" },
      { title: "Request Scanning", slug: "gateway/request-scanning" },
      { title: "Response Scanning", slug: "gateway/response-scanning" },
      { title: "AST Analysis", slug: "gateway/ast-analysis" },
    ],
  },
  {
    title: "Server (preview)",
    items: [
      { title: "Overview", slug: "server/overview" },
      { title: "REST API", slug: "server/rest-api" },
      { title: "Authentication", slug: "server/authentication" },
      { title: "Webhooks", slug: "server/webhooks" },
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
    title: "LSP Server",
    items: [
      { title: "Overview", slug: "lsp/overview" },
      { title: "Diagnostics", slug: "lsp/diagnostics" },
      { title: "Editor Setup", slug: "lsp/editor-setup" },
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
      { title: "Packaging", slug: "deployment/packaging" },
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
