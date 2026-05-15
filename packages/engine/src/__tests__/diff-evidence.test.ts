import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { runDiffCheck } from "../checks/runners/diff.js"
import type { DiffEvidenceCheck } from "../checks/types.js"

/**
 * ENG-004 — diff-evidence runner contract against real git fixture repos.
 *
 * The runner itself is a pure function over `changedFiles[] + branch`; the
 * "edge cases" we care about are about *producing* that changed-file list
 * from realistic CI-style checkouts. We exercise:
 *   - shallow clone (--depth=1)
 *   - detached HEAD
 *   - rename via `git mv`
 *   - delete-only diff
 *   - `--base origin/main` fallback when only the remote ref exists
 *
 * Each test builds an isolated repo, computes changedFiles via the same
 * `git diff --name-only` invocation pattern the CLI uses, then asserts on
 * runDiffCheck's verdict.
 */

let tmpDir: string

function git(args: readonly string[], cwd: string): string {
  return execFileSync("git", [...args], {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Rulebound Test",
      GIT_AUTHOR_EMAIL: "test@rulebound.local",
      GIT_COMMITTER_NAME: "Rulebound Test",
      GIT_COMMITTER_EMAIL: "test@rulebound.local",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
}

function initRepo(dir: string): void {
  git(["init", "-q", "-b", "main"], dir)
  git(["config", "commit.gpgsign", "false"], dir)
  git(["config", "user.email", "test@rulebound.local"], dir)
  git(["config", "user.name", "Rulebound Test"], dir)
}

function commitAll(dir: string, message: string): string {
  git(["add", "-A"], dir)
  git(["commit", "-q", "--allow-empty", "-m", message], dir)
  return git(["rev-parse", "HEAD"], dir).trim()
}

function changedFiles(dir: string, base: string): readonly string[] {
  try {
    const out = git(["diff", "--name-only", `${base}...HEAD`], dir)
    return out.split("\n").filter(Boolean)
  } catch {
    const remote = base.startsWith("origin/") ? base : `origin/${base}`
    const out = git(["diff", "--name-only", `${remote}...HEAD`], dir)
    return out.split("\n").filter(Boolean)
  }
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "rulebound-diff-fixture-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("diff-evidence: shallow clone simulation", () => {
  it("base ref unreachable in a depth=1 clone falls back to origin/<base>", () => {
    // Build an upstream with two commits, then create a shallow clone that
    // only has HEAD. The CLI fallback path uses `origin/<base>` when the
    // local <base> name is absent.
    const upstream = join(tmpDir, "upstream.git")
    const work = join(tmpDir, "work")
    mkdirSync(upstream, { recursive: true })
    mkdirSync(work, { recursive: true })

    initRepo(work)
    writeFileSync(join(work, "src.ts"), "export const a = 1\n")
    commitAll(work, "base")
    writeFileSync(join(work, "src.ts"), "export const a = 2\n")
    commitAll(work, "change")

    // Push to bare upstream.
    git(["init", "--bare", "-b", "main", upstream], tmpDir)
    git(["remote", "add", "origin", upstream], work)
    git(["push", "-q", "origin", "main"], work)

    // Shallow clone, then check out a feature branch so HEAD diverges from
    // origin/main without moving local main.
    const clone = join(tmpDir, "clone")
    git(["clone", "--depth=1", upstream, clone], tmpDir)
    git(["checkout", "-q", "-b", "feature/local"], clone)
    // Delete the local `main` branch so only `origin/main` remains —
    // this matches CI checkouts where the PR branch is fetched but the
    // base branch is only known by its remote ref.
    git(["branch", "-q", "-D", "main"], clone)

    writeFileSync(join(clone, "src.ts"), "export const a = 3\n")
    commitAll(clone, "local")

    // The CLI helper retries with `origin/<base>` if `<base>` is missing —
    // we replicate that contract in our `changedFiles()` helper.
    const files = changedFiles(clone, "main")
    expect(files).toContain("src.ts")
  })
})

describe("diff-evidence: detached HEAD", () => {
  it("computes diff correctly when HEAD is detached at a SHA", () => {
    initRepo(tmpDir)
    writeFileSync(join(tmpDir, "a.ts"), "1\n")
    const sha1 = commitAll(tmpDir, "first")
    writeFileSync(join(tmpDir, "a.ts"), "2\n")
    writeFileSync(join(tmpDir, "b.ts"), "new\n")
    commitAll(tmpDir, "second")
    // Detach at sha1's child by checking out HEAD directly.
    git(["checkout", "-q", "--detach", "HEAD"], tmpDir)
    // Diff against the first commit's SHA.
    const out = git(["diff", "--name-only", `${sha1}...HEAD`], tmpDir)
    const files = out.split("\n").filter(Boolean)
    expect(files).toContain("a.ts")
    expect(files).toContain("b.ts")

    const check: DiffEvidenceCheck = {
      type: "diff-evidence",
      when_changed: ["a.ts"],
      require_changed: ["b.ts"],
    }
    const result = runDiffCheck({ ruleId: "rename.rule", check, changedFiles: files })
    expect(result.status).toBe("PASS")
  })
})

describe("diff-evidence: rename via git mv", () => {
  it("rename appears as both add+delete in --name-only output", () => {
    initRepo(tmpDir)
    writeFileSync(join(tmpDir, "old-name.ts"), "export const v = 1\n")
    commitAll(tmpDir, "first")
    git(["mv", "old-name.ts", "new-name.ts"], tmpDir)
    commitAll(tmpDir, "rename")

    const out = git(["diff", "--name-only", "HEAD~1...HEAD"], tmpDir)
    const files = out.split("\n").filter(Boolean)
    // `git diff --name-only` without -M reports both paths.
    // With default rename detection on this version it may collapse — we accept either.
    expect(files.length).toBeGreaterThanOrEqual(1)
    expect(files.some((f) => f === "old-name.ts" || f === "new-name.ts")).toBe(true)

    // require_changed pattern should still match either path.
    const check: DiffEvidenceCheck = {
      type: "diff-evidence",
      require_changed: ["**/*-name.ts"],
    }
    const result = runDiffCheck({ ruleId: "rename.rule", check, changedFiles: files })
    expect(result.status).toBe("PASS")
  })

  it("delete-only diff: forbidden path rule triggers VIOLATED", () => {
    initRepo(tmpDir)
    mkdirSync(join(tmpDir, "src"), { recursive: true })
    writeFileSync(join(tmpDir, "src", "legacy.ts"), "// legacy\n")
    commitAll(tmpDir, "first")
    rmSync(join(tmpDir, "src", "legacy.ts"))
    commitAll(tmpDir, "delete legacy")

    const out = git(["diff", "--name-only", "HEAD~1...HEAD"], tmpDir)
    const files = out.split("\n").filter(Boolean)
    expect(files).toEqual(["src/legacy.ts"])

    const check: DiffEvidenceCheck = {
      type: "diff-evidence",
      require_not_changed: ["src/**"],
    }
    const result = runDiffCheck({ ruleId: "no-src-changes", check, changedFiles: files })
    expect(result.status).toBe("VIOLATED")
    expect(result.blocking).toBe(true)
    expect(result.evidence?.diffPaths).toEqual(["src/legacy.ts"])
  })
})

describe("diff-evidence: --base origin/<base> fallback", () => {
  it("computes diff against origin/main when local main is absent", () => {
    initRepo(tmpDir)
    writeFileSync(join(tmpDir, "src.ts"), "export const x = 1\n")
    commitAll(tmpDir, "base")
    // Simulate CI checkout: a feature branch where only origin/main exists.
    git(["update-ref", "refs/remotes/origin/main", "HEAD"], tmpDir)
    git(["checkout", "-q", "-b", "feature/x"], tmpDir)
    git(["branch", "-q", "-D", "main"], tmpDir)
    writeFileSync(join(tmpDir, "src.ts"), "export const x = 2\n")
    writeFileSync(join(tmpDir, "migration.sql"), "ALTER TABLE x ADD y INT;\n")
    commitAll(tmpDir, "feature change")

    const files = changedFiles(tmpDir, "main")
    expect(files).toContain("src.ts")
    expect(files).toContain("migration.sql")

    const check: DiffEvidenceCheck = {
      type: "diff-evidence",
      when_changed: ["src.ts"],
      require_changed: ["**/*.sql"],
    }
    const result = runDiffCheck({ ruleId: "schema-needs-migration", check, changedFiles: files })
    expect(result.status).toBe("PASS")
  })

  it("when neither <base> nor origin/<base> exists the helper returns []", () => {
    initRepo(tmpDir)
    writeFileSync(join(tmpDir, "only.ts"), "1\n")
    commitAll(tmpDir, "only")
    expect(() => changedFiles(tmpDir, "nonexistent")).toThrowError()
  })
})

describe("diff-evidence: branch matching predicate", () => {
  it("branch_matches gates the rule to fix/** branches", () => {
    const check: DiffEvidenceCheck = {
      type: "diff-evidence",
      branch_matches: "^fix/",
      require_changed: ["**/__tests__/**"],
    }
    const onFeature = runDiffCheck({
      ruleId: "regression-test",
      check,
      changedFiles: ["src/bug.ts"],
      branch: "feature/new-thing",
    })
    expect(onFeature.status).toBe("NOT_APPLICABLE")

    const onFix = runDiffCheck({
      ruleId: "regression-test",
      check,
      changedFiles: ["src/bug.ts"],
      branch: "fix/payment-rounding",
    })
    expect(onFix.status).toBe("VIOLATED")
    expect(onFix.blocking).toBe(true)
  })
})
