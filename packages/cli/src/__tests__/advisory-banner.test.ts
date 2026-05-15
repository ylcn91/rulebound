import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import {
  ADVISORY_BANNER_TEXT,
  printAdvisoryBanner,
} from "../lib/advisory-banner.js"
import { validateCommand } from "../commands/validate.js"
import { diffCommand } from "../commands/diff.js"
import { ciCommand } from "../commands/ci.js"
import { reviewCommand } from "../commands/review.js"

interface CapturedRun {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

interface TmpRepo {
  readonly dir: string
  cleanup(): void
}

function makeRepoWithRules(): TmpRepo {
  const dir = mkdtempSync(join(tmpdir(), "rulebound-advisory-banner-"))
  // git init so diff/ci helpers do not bail before banner emits.
  execFileSync("git", ["init", "-q"], { cwd: dir })
  execFileSync("git", ["config", "user.email", "smoke@rulebound.local"], { cwd: dir })
  execFileSync("git", ["config", "user.name", "smoke"], { cwd: dir })
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: dir })

  mkdirSync(join(dir, ".rulebound", "rules", "global"), { recursive: true })
  writeFileSync(
    join(dir, ".rulebound", "rules", "global", "example.md"),
    `---
title: Example rule
category: style
severity: warning
modality: should
tags: [example]
---

# Example

- Do nice things.
`,
  )
  return {
    dir,
    cleanup() {
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

describe("advisory banner helper", () => {
  let stdout: string[]
  let stderr: string[]
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdout = []
    stderr = []
    logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      stdout.push(args.map((a) => String(a)).join(" "))
    })
    errSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      stderr.push(args.map((a) => String(a)).join(" "))
    })
  })

  afterEach(() => {
    logSpy.mockRestore()
    errSpy.mockRestore()
  })

  it("emits to stdout for human/pretty format", () => {
    printAdvisoryBanner(undefined)
    expect(stdout.join("\n")).toContain(ADVISORY_BANNER_TEXT)
    expect(stderr.join("\n")).not.toContain(ADVISORY_BANNER_TEXT)
  })

  it("emits to stdout when format is pretty", () => {
    printAdvisoryBanner("pretty")
    expect(stdout.join("\n")).toContain(ADVISORY_BANNER_TEXT)
    expect(stderr.join("\n")).not.toContain(ADVISORY_BANNER_TEXT)
  })

  it("emits to stderr for json so stdout stays parseable", () => {
    printAdvisoryBanner("json")
    expect(stdout.join("\n")).not.toContain(ADVISORY_BANNER_TEXT)
    expect(stderr.join("\n")).toContain(ADVISORY_BANNER_TEXT)
  })

  it("emits to stderr for sarif / github / repair-json / pr-markdown", () => {
    for (const fmt of ["sarif", "github", "repair-json", "pr-markdown"]) {
      stdout.length = 0
      stderr.length = 0
      printAdvisoryBanner(fmt)
      expect(stdout.join("\n")).not.toContain(ADVISORY_BANNER_TEXT)
      expect(stderr.join("\n")).toContain(ADVISORY_BANNER_TEXT)
    }
  })
})

describe("legacy advisory commands emit the banner", () => {
  let repo: TmpRepo
  let originalCwd: string
  let stdout: string[]
  let stderr: string[]
  let exitSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalCwd = process.cwd()
    repo = makeRepoWithRules()
    process.chdir(repo.dir)
    stdout = []
    stderr = []
    logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      stdout.push(args.map((a) => String(a)).join(" "))
    })
    errSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      stderr.push(args.map((a) => String(a)).join(" "))
    })
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__EXIT__:${code ?? 0}`)
    }) as never)
  })

  afterEach(() => {
    exitSpy.mockRestore()
    logSpy.mockRestore()
    errSpy.mockRestore()
    process.chdir(originalCwd)
    repo.cleanup()
  })

  async function safeRun(fn: () => Promise<void>): Promise<CapturedRun> {
    let code = 0
    try {
      await fn()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const m = msg.match(/__EXIT__:(\d+)/)
      if (m) {
        code = Number(m[1])
      } else {
        throw e
      }
    }
    return { code, stdout: stdout.join("\n"), stderr: stderr.join("\n") }
  }

  it("validate emits the banner before running", async () => {
    const r = await safeRun(() => validateCommand({ plan: "implement feature X" }))
    // banner lives on stdout for pretty/human output (default)
    expect(r.stdout).toContain(ADVISORY_BANNER_TEXT)
  })

  it("validate routes the banner to stderr for --format json", async () => {
    const r = await safeRun(() =>
      validateCommand({ plan: "implement feature X", format: "json" }),
    )
    expect(r.stderr).toContain(ADVISORY_BANNER_TEXT)
    // stdout must remain pure JSON (single trailing JSON object).
    const stdoutJson = r.stdout.trim()
    // The validateCommand emits JSON via console.log once; stdout may contain just that object.
    expect(stdoutJson).not.toContain(ADVISORY_BANNER_TEXT)
  })

  it("diff emits the banner before running", async () => {
    const r = await safeRun(() => diffCommand({}))
    expect(r.stdout).toContain(ADVISORY_BANNER_TEXT)
  })

  it("ci emits the banner; stderr for --format github", async () => {
    const r = await safeRun(() => ciCommand({ format: "github" }))
    // ci emits a GitHub annotation to stdout; banner must be on stderr.
    expect(r.stderr).toContain(ADVISORY_BANNER_TEXT)
    expect(r.stdout).not.toContain(ADVISORY_BANNER_TEXT)
  })

  it("review emits the banner before running", async () => {
    const r = await safeRun(() => reviewCommand({ plan: "implement feature X" }))
    expect(r.stdout).toContain(ADVISORY_BANNER_TEXT)
  })
})
