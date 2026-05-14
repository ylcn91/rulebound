import { existsSync, readdirSync, statSync } from "node:fs"
import { resolve, join } from "node:path"

export interface PackDefinition {
  readonly name: string
  readonly description: string
  readonly sources: readonly string[]
}

export const PACK_REGISTRY: readonly PackDefinition[] = [
  {
    name: "starter",
    description:
      "Minimal first-run pack. Pure deterministic checks, no external analyzers, no --allow-commands",
    sources: [
      "deterministic/no-hardcoded-secrets.md",
      "deterministic/no-debugger.md",
      "deterministic/schema-needs-migration.md",
    ],
  },
  {
    name: "typescript",
    description: "TypeScript hygiene: strict types, error handling, zod boundaries",
    sources: ["typescript"],
  },
  {
    name: "security",
    description: "Common secret/credential and input-sanitization rules",
    sources: ["security"],
  },
  {
    name: "react",
    description: "React/Next.js patterns (hooks, server components, a11y)",
    sources: ["react"],
  },
  {
    name: "java-spring",
    description: "Java + Spring Boot conventions",
    sources: ["java-spring"],
  },
  {
    name: "go",
    description: "Go idioms (errors, logging, panic policy)",
    sources: ["go"],
  },
  {
    name: "infra",
    description: "Infra rules (Docker, container runtime, resource limits)",
    sources: ["infra"],
  },
  {
    name: "global",
    description: "Cross-cutting code review, error handling, logging",
    sources: ["global"],
  },
  {
    name: "agent-workflow",
    description:
      "Agent bugfix evidence + plan validation (spec + regression test + schema/arch boundaries). No analyzer rules",
    sources: [
      "workflow",
      "deterministic/bugfix-needs-spec.md",
      "deterministic/bugfix-needs-regression-test.md",
      "deterministic/schema-needs-migration.md",
      "deterministic/architecture-boundary.md",
    ],
  },
  {
    name: "monorepo",
    description:
      "Monorepo discipline: schema migrations, no hardcoded secrets, no debugger statements",
    sources: [
      "deterministic/schema-needs-migration.md",
      "deterministic/no-hardcoded-secrets.md",
      "deterministic/no-debugger.md",
    ],
  },
  {
    name: "deterministic",
    description:
      "Curated pure-deterministic checks (no external analyzers): boundary, bugfix evidence, secrets, debugger, schema migration",
    sources: [
      "deterministic/architecture-boundary.md",
      "deterministic/bugfix-needs-spec.md",
      "deterministic/bugfix-needs-regression-test.md",
      "deterministic/no-debugger.md",
      "deterministic/no-hardcoded-secrets.md",
      "deterministic/schema-needs-migration.md",
    ],
  },
  {
    name: "analyzer-typescript",
    description:
      "Analyzer orchestration for TypeScript (requires eslint, tsc on PATH or in node_modules). Opt-in",
    sources: ["deterministic/eslint-pack.md", "deterministic/tsc-pack.md"],
  },
  {
    name: "analyzer-java",
    description:
      "Analyzer orchestration for Java (requires PMD, Checkstyle, SpotBugs, JUnit/ArchUnit on PATH). Opt-in",
    sources: [
      "deterministic/pmd-pack.md",
      "deterministic/checkstyle-pack.md",
      "deterministic/spotbugs-pack.md",
      "deterministic/junit-pack.md",
    ],
  },
  {
    name: "analyzer-security",
    description:
      "Analyzer orchestration for security scanners (requires semgrep, gitleaks on PATH). Opt-in",
    sources: ["deterministic/semgrep-pack.md", "deterministic/gitleaks-pack.md"],
  },
]

export function packNames(): readonly string[] {
  return PACK_REGISTRY.map((p) => p.name)
}

export function findPack(name: string): PackDefinition | undefined {
  return PACK_REGISTRY.find((p) => p.name === name)
}

export interface ExamplesRoot {
  readonly path: string
  readonly origin: "bundled" | "repo"
}

export function findExamplesRoot(cwd: string = process.cwd()): ExamplesRoot | null {
  try {
    const here = new URL(".", import.meta.url).pathname
    const packagedCandidates = [
      resolve(here, "..", "rules", "examples"),
      resolve(here, "..", "..", "rules", "examples"),
      resolve(here, "..", "examples", "rules"),
    ]
    for (const candidate of packagedCandidates) {
      if (existsSync(candidate)) return { path: candidate, origin: "bundled" }
    }
  } catch {
    // ignore
  }

  let dir = cwd
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "examples", "rules")
    if (existsSync(candidate)) return { path: candidate, origin: "repo" }
    const parent = resolve(dir, "..")
    if (parent === dir) break
    dir = parent
  }
  return null
}

export interface PackResolution {
  readonly pack: PackDefinition
  readonly entries: readonly PackEntry[]
}

export interface PackEntry {
  readonly source: string
  readonly destSubdir: string
  readonly isDirectory: boolean
}

export function resolvePackEntries(pack: PackDefinition, examplesRoot: string): PackResolution {
  const entries: PackEntry[] = []
  for (const src of pack.sources) {
    const abs = resolve(examplesRoot, src)
    if (!existsSync(abs)) continue
    const isDir = isDirectory(abs)
    entries.push({
      source: abs,
      destSubdir: isDir ? sanitizeDestSubdir(src) : sanitizeDestSubdir(pack.name),
      isDirectory: isDir,
    })
  }
  return { pack, entries }
}

function sanitizeDestSubdir(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/$/, "").replace(/\//g, "-")
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export function listPackContents(pack: PackDefinition, examplesRoot: string): readonly string[] {
  const files: string[] = []
  for (const src of pack.sources) {
    const abs = resolve(examplesRoot, src)
    if (!existsSync(abs)) continue
    if (isDirectory(abs)) {
      try {
        for (const f of readdirSync(abs)) {
          if (f.endsWith(".md")) files.push(`${src}/${f}`)
        }
      } catch {
        // ignore
      }
    } else if (src.endsWith(".md")) {
      files.push(src)
    }
  }
  return files
}
