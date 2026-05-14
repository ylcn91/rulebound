import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { initCommand } from "./init.js"
import { PRE_COMMIT_HOOK_CONTENT } from "../lib/pre-commit-hook.js"

describe("initCommand", () => {
  const originalCwd = process.cwd()
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rulebound-init-"))
    mkdirSync(join(tempDir, ".git"), { recursive: true })
    process.chdir(tempDir)
    vi.spyOn(console, "log").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.chdir(originalCwd)
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("auto-installs the same staged-only hook during init", async () => {
    await initCommand({})

    const hookPath = join(tempDir, ".git", "hooks", "pre-commit")
    expect(readFileSync(hookPath, "utf-8")).toBe(PRE_COMMIT_HOOK_CONTENT)
    expect(existsSync(join(tempDir, ".rulebound", "rules", "global", "example-rule.md"))).toBe(true)
  })

  it("installs only the requested packs and copies real .md files", async () => {
    await initCommand({ pack: ["typescript", "security"], hook: false })
    const rulesDir = join(tempDir, ".rulebound", "rules")
    expect(existsSync(join(rulesDir, "typescript"))).toBe(true)
    expect(existsSync(join(rulesDir, "security"))).toBe(true)
    expect(existsSync(join(rulesDir, "java-spring"))).toBe(false)
    expect(existsSync(join(rulesDir, "go"))).toBe(false)
    expect(existsSync(join(rulesDir, "global", "example-rule.md"))).toBe(false)

    const tsFiles = readdirSync(join(rulesDir, "typescript")).filter((f) => f.endsWith(".md"))
    expect(tsFiles.length).toBeGreaterThan(0)
    const secFiles = readdirSync(join(rulesDir, "security")).filter((f) => f.endsWith(".md"))
    expect(secFiles.length).toBeGreaterThan(0)
  })

  it("agent-workflow pack pulls workflow rules + bugfix/schema/arch evidence but no analyzer rules", async () => {
    await initCommand({ pack: ["agent-workflow"], hook: false })
    const rulesDir = join(tempDir, ".rulebound", "rules")
    expect(existsSync(join(rulesDir, "workflow"))).toBe(true)
    const wfFiles = readdirSync(join(rulesDir, "workflow")).filter((f) => f.endsWith(".md"))
    expect(wfFiles.length).toBeGreaterThan(0)
    const awDir = join(rulesDir, "agent-workflow")
    expect(existsSync(awDir)).toBe(true)
    const awFiles = readdirSync(awDir).filter((f) => f.endsWith(".md"))
    expect(awFiles).toContain("bugfix-needs-spec.md")
    expect(awFiles).toContain("bugfix-needs-regression-test.md")
    expect(awFiles).toContain("schema-needs-migration.md")
    expect(awFiles).toContain("architecture-boundary.md")
    // analyzer rules MUST NOT be installed by agent-workflow
    expect(awFiles).not.toContain("eslint-pack.md")
    expect(awFiles).not.toContain("pmd-pack.md")
    expect(awFiles).not.toContain("semgrep-pack.md")
    expect(awFiles).not.toContain("gitleaks-pack.md")
  })

  it("starter pack installs a minimal deterministic set with no analyzer rules", async () => {
    await initCommand({ pack: ["starter"], hook: false })
    const rulesDir = join(tempDir, ".rulebound", "rules")
    const starterDir = join(rulesDir, "starter")
    expect(existsSync(starterDir)).toBe(true)
    const files = readdirSync(starterDir).filter((f) => f.endsWith(".md"))
    expect(files).toContain("no-hardcoded-secrets.md")
    expect(files).toContain("no-debugger.md")
    expect(files).toContain("schema-needs-migration.md")
    expect(files).not.toContain("eslint-pack.md")
    expect(files).not.toContain("pmd-pack.md")
    expect(files).not.toContain("semgrep-pack.md")
  })

  it("deterministic pack excludes analyzer-* rules", async () => {
    await initCommand({ pack: ["deterministic"], hook: false })
    const rulesDir = join(tempDir, ".rulebound", "rules")
    const detDir = join(rulesDir, "deterministic")
    expect(existsSync(detDir)).toBe(true)
    const files = readdirSync(detDir).filter((f) => f.endsWith(".md"))
    expect(files).toContain("no-hardcoded-secrets.md")
    expect(files).toContain("no-debugger.md")
    expect(files).toContain("architecture-boundary.md")
    expect(files).not.toContain("eslint-pack.md")
    expect(files).not.toContain("tsc-pack.md")
    expect(files).not.toContain("pmd-pack.md")
    expect(files).not.toContain("checkstyle-pack.md")
    expect(files).not.toContain("spotbugs-pack.md")
    expect(files).not.toContain("junit-pack.md")
    expect(files).not.toContain("semgrep-pack.md")
    expect(files).not.toContain("gitleaks-pack.md")
  })

  it("analyzer-typescript pack installs eslint + tsc analyzer rules", async () => {
    await initCommand({ pack: ["analyzer-typescript"], hook: false })
    const rulesDir = join(tempDir, ".rulebound", "rules")
    const dir = join(rulesDir, "analyzer-typescript")
    expect(existsSync(dir)).toBe(true)
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"))
    expect(files).toContain("eslint-pack.md")
    expect(files).toContain("tsc-pack.md")
  })

  it("analyzer-java pack installs PMD/Checkstyle/SpotBugs/JUnit analyzer rules", async () => {
    await initCommand({ pack: ["analyzer-java"], hook: false })
    const rulesDir = join(tempDir, ".rulebound", "rules")
    const dir = join(rulesDir, "analyzer-java")
    expect(existsSync(dir)).toBe(true)
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"))
    expect(files).toContain("pmd-pack.md")
    expect(files).toContain("checkstyle-pack.md")
    expect(files).toContain("spotbugs-pack.md")
    expect(files).toContain("junit-pack.md")
  })

  it("analyzer-security pack installs semgrep + gitleaks analyzer rules", async () => {
    await initCommand({ pack: ["analyzer-security"], hook: false })
    const rulesDir = join(tempDir, ".rulebound", "rules")
    const dir = join(rulesDir, "analyzer-security")
    expect(existsSync(dir)).toBe(true)
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"))
    expect(files).toContain("semgrep-pack.md")
    expect(files).toContain("gitleaks-pack.md")
  })

  it("rejects unknown pack names with exit 2", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__EXIT__:${code ?? 0}`)
    }) as never)
    let code = -1
    try {
      await initCommand({ pack: ["typescript", "not-a-real-pack"], hook: false })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const m = msg.match(/__EXIT__:(\d+)/)
      if (m) code = Number(m[1])
    }
    expect(code).toBe(2)
    exitSpy.mockRestore()
  })

  it("--examples still works as before", async () => {
    await initCommand({ examples: true, hook: false })
    const rulesDir = join(tempDir, ".rulebound", "rules")
    expect(existsSync(join(rulesDir, "typescript"))).toBe(true)
    expect(existsSync(join(rulesDir, "security"))).toBe(true)
    expect(existsSync(join(rulesDir, "java-spring"))).toBe(true)
  })
})
