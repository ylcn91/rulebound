import type { Rule as LocalRule } from "@rulebound/engine"
import type { ValidationReport, ValidationResult } from "./types.js"

export {
  findRulesDir,
  loadLocalRules,
  filterRules,
  detectProjectStack,
  detectLanguageFromCode,
} from "@rulebound/engine"

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "will", "have", "been",
  "into", "using", "make", "code", "want", "need", "like", "some", "also",
  "when", "then", "than", "more", "should", "would", "could", "about",
  "each", "which", "their", "there", "what", "your", "does", "just",
])

// --- Validation ---

// Explicit violation patterns per rule domain
const VIOLATION_PATTERNS: Record<string, Array<{ match: RegExp; message: string; fix: string }>> = {
  "field injection": [
    { match: /@autowired/i, message: "Field injection detected", fix: "Use constructor injection with final fields" },
    { match: /field\s+inject/i, message: "Field injection planned", fix: "Use constructor injection with final fields" },
  ],
  "hardcoded secrets": [
    { match: /hardcod(e|ed|ing)\s*(secret|key|password|token|credential)/i, message: "Hardcoded secrets planned", fix: "Use environment variables or secrets manager" },
    { match: /(api.?key|password|secret|token)\s*=\s*["'][^"']*["']/i, message: "Inline secret value", fix: "Load from environment variables" },
  ],
  "localstorage token": [
    { match: /localstorage/i, message: "localStorage usage for sensitive data", fix: "Use httpOnly cookies for token storage" },
    { match: /session\s*storage.*token/i, message: "sessionStorage for tokens", fix: "Use httpOnly cookies for token storage" },
  ],
  "latest tag": [
    { match: /:latest\b/i, message: "Using :latest tag", fix: "Pin specific version for reproducibility" },
    { match: /use\s+latest/i, message: "Planning to use latest", fix: "Pin specific version" },
  ],
  "h2 database": [
    { match: /\bh2\b.*\b(database|db|mem)\b/i, message: "H2 in-memory database planned", fix: "Use Testcontainers with real database" },
    { match: /embedded\s+database/i, message: "Embedded database planned", fix: "Use Testcontainers with production-equivalent database" },
    { match: /in-memory\s+(db|database)/i, message: "In-memory database planned", fix: "Use Testcontainers with real database" },
  ],
  "new connection per request": [
    { match: /new\s+(jedis|connection|redis\s*client)\s*\(/i, message: "Creating new connection per request", fix: "Use connection pool" },
    { match: /create.*connection.*each/i, message: "Per-request connections", fix: "Use connection pool with configured limits" },
  ],
  "domain spring dependency": [
    { match: /import\s+org\.springframework.*domain/i, message: "Spring import in domain layer", fix: "Domain module must not depend on Spring framework" },
    { match: /domain.*(spring|@service|@component|@autowired)/i, message: "Spring annotation in domain", fix: "Keep domain module framework-free" },
  ],
  "force push": [
    { match: /push\s+--force\b/i, message: "Force push planned", fix: "Use --force-with-lease or avoid force push" },
    { match: /git\s+push\s+-f\b/i, message: "Force push planned", fix: "Use --force-with-lease" },
  ],
  "no resource limits": [
    { match: /without\s+(resource|cpu|memory)\s*limit/i, message: "Missing resource limits", fix: "Set CPU and memory requests/limits for all containers" },
  ],
  "new dockerfile": [
    { match: /create\s+(a\s+)?(new\s+)?dockerfile/i, message: "Creating new Dockerfile", fix: "Use existing Dockerfile; modify it if changes are needed" },
  ],
  "git author override": [
    { match: /git\s+config\s+user\.(name|email)/i, message: "Overriding git author", fix: "Use Co-authored-by trailer instead" },
    { match: /--author\s*=/i, message: "Using --author flag", fix: "Use Co-authored-by trailer" },
  ],
  "console log": [
    { match: /console\.log\s*\(/i, message: "console.log detected", fix: "Use a structured logger (winston, pino) instead of console.log" },
    { match: /console\.log/i, message: "console.log usage planned", fix: "Use a structured logger instead of console.log" },
    { match: /debug\s*(log|print|output)/i, message: "Debug logging planned", fix: "Use structured logger; remove debug statements before committing" },
  ],
  "any type": [
    { match: /:\s*any\b/i, message: "TypeScript 'any' type usage", fix: "Use 'unknown' with type guards or define a proper interface" },
    { match: /as\s+any\b/i, message: "Type assertion to 'any'", fix: "Use 'unknown' with type narrowing instead of 'any'" },
    { match: /\bany\s+type/i, message: "'any' type planned", fix: "Define proper TypeScript interfaces or use 'unknown'" },
    { match: /type\s+any\b/i, message: "'any' type usage", fix: "Use 'unknown' with type guards or proper interfaces" },
  ],
  "mutation": [
    { match: /\.push\s*\(/i, message: "Array mutation via push()", fix: "Use spread operator: [...arr, newItem] instead of arr.push()" },
    { match: /\.splice\s*\(/i, message: "Array mutation via splice()", fix: "Use filter/slice to create new arrays" },
    { match: /\.sort\s*\(/i, message: "In-place sort mutation", fix: "Use [...arr].sort() or toSorted() to avoid mutation" },
    { match: /(?:^|[^=!<>])\w+\.\w+\s*=[^=>]/m, message: "Direct property mutation", fix: "Create new objects with spread: { ...obj, prop: newValue }" },
    { match: /\bmutate\b|\bmutation\b|modify\s+in\s*place/i, message: "Mutation pattern planned", fix: "Use immutable patterns: spread, map, filter" },
  ],
  "file size": [
    { match: /single\s+(?:large\s+)?file/i, message: "Single large file approach", fix: "Split into smaller files (200-400 lines). Organize by feature/domain" },
    { match: /everything\s+in\s+one/i, message: "Monolithic file planned", fix: "Split into focused modules under 400 lines each" },
    { match: /(?:1[0-9]{3}|[2-9]\d{3})\s*lines/i, message: "File exceeding size limit", fix: "Files must stay under 400 lines (800 max). Extract utilities and components" },
  ],
  "skip tests": [
    { match: /skip\s*(the\s+)?test/i, message: "Skipping tests", fix: "Write tests first (TDD). Minimum 80% coverage required" },
    { match: /no\s+tests?\s+(needed|required|necessary)/i, message: "Skipping tests", fix: "All features require unit and integration tests" },
    { match: /without\s+(writing\s+)?tests/i, message: "No tests planned", fix: "Write tests first, then implement" },
    { match: /test(s|ing)?\s+(later|afterward|after)/i, message: "Deferring tests", fix: "Follow TDD: write tests first, then implement" },
  ],
  "server components": [
    { match: /["']use\s+client["']\s*(everywhere|by\s+default|on\s+every)/i, message: "'use client' overuse planned", fix: "Server Components by default; only add 'use client' for interactivity" },
    { match: /make\s+(everything|all|every\w*)\s+client/i, message: "Unnecessary client components", fix: "Keep Server Components as default. Only use 'use client' when needed for hooks/events" },
  ],
}

// Map rule IDs/tags to violation pattern keys
function getViolationKeysForRule(rule: LocalRule): string[] {
  const keys: string[] = []
  const id = rule.id.toLowerCase()
  const title = rule.title.toLowerCase()
  const tags = rule.tags.map((t) => t.toLowerCase())

  if (id.includes("dependency-injection") || tags.includes("di") || title.includes("constructor")) {
    keys.push("field injection")
  }
  if (id.includes("secrets") || tags.includes("secrets") || title.includes("secret")) {
    keys.push("hardcoded secrets")
  }
  if (id.includes("authentication") || tags.includes("auth") || title.includes("authentication")) {
    keys.push("localstorage token")
  }
  if (id.includes("latest") || tags.includes("latest") || title.includes("latest")) {
    keys.push("latest tag")
  }
  if (id.includes("testcontainers") || tags.includes("testcontainers")) {
    keys.push("h2 database")
  }
  if (id.includes("connection-pool") || tags.includes("connection-pool") || title.includes("connection pool")) {
    keys.push("new connection per request")
  }
  if (id.includes("hexagonal") || tags.includes("hexagonal") || title.includes("hexagonal")) {
    keys.push("domain spring dependency")
  }
  if (id.includes("dockerfile") || title.includes("existing dockerfile")) {
    keys.push("new dockerfile")
  }
  if (id.includes("git-author") || tags.includes("ai-agent") || title.includes("author")) {
    keys.push("git author override")
  }
  if (id.includes("kubernetes") || tags.includes("k8s") || title.includes("resource limit")) {
    keys.push("no resource limits")
  }
  if (id.includes("console") || tags.includes("console") || tags.includes("logging") || title.includes("console")) {
    keys.push("console log")
  }
  if (id.includes("no-any") || tags.includes("any") || tags.includes("type-safety") || title.includes("any")) {
    keys.push("any type")
  }
  if (id.includes("immutab") || tags.includes("immutability") || tags.includes("mutation") || title.includes("immutable") || title.includes("mutation")) {
    keys.push("mutation")
  }
  if (id.includes("file-size") || tags.includes("file-size") || title.includes("file size")) {
    keys.push("file size")
  }
  if (id.includes("testing") || tags.includes("testing") || tags.includes("unit-tests") || title.includes("testing")) {
    keys.push("skip tests")
  }
  if (id.includes("server-component") || tags.includes("server-components") || title.includes("server component")) {
    keys.push("server components")
  }

  return keys
}

export function validatePlanAgainstRules(plan: string, rules: LocalRule[], task?: string): ValidationReport {
  const results: ValidationResult[] = []

  for (const rule of rules) {
    const violationKeys = getViolationKeysForRule(rule)
    let violated = false

    for (const key of violationKeys) {
      const patterns = VIOLATION_PATTERNS[key]
      if (!patterns) continue

      for (const { match, message, fix } of patterns) {
        if (match.test(plan)) {
          results.push({
            ruleId: rule.id,
            ruleTitle: rule.title,
            severity: rule.severity,
            modality: rule.modality,
            status: "VIOLATED",
            reason: message,
            suggestedFix: fix,
          })
          violated = true
          break
        }
      }
      if (violated) break
    }

    if (!violated) {
      // Check if the plan at least addresses the rule topic
      const ruleTags = rule.tags.map((t) => t.toLowerCase())
      const titleWords = rule.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w))
      const planLower = plan.toLowerCase()

      const addressed = ruleTags.some((t) => planLower.includes(t)) ||
        titleWords.filter((w) => planLower.includes(w)).length >= 2

      results.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        severity: rule.severity,
        modality: rule.modality,
        status: addressed ? "PASS" : "NOT_COVERED",
        reason: addressed ? "Plan addresses this rule" : "Rule not addressed in plan",
      })
    }
  }

  const summary = {
    pass: results.filter((r) => r.status === "PASS").length,
    violated: results.filter((r) => r.status === "VIOLATED").length,
    notCovered: results.filter((r) => r.status === "NOT_COVERED").length,
  }

  const hasMustViolation = results.some((r) => r.status === "VIOLATED" && r.modality === "must")

  return {
    task: task ?? plan.slice(0, 100),
    rulesTotal: rules.length,
    results,
    summary,
    status: hasMustViolation ? "FAILED" : summary.violated > 0 ? "PASSED_WITH_WARNINGS" : "PASSED",
  }
}
