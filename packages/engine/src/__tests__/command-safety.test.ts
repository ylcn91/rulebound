import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCommandCheck } from "../checks/runners/command.js"
import { runAnalyzerCheck } from "../checks/runners/analyzer.js"
import type { CommandCheck } from "../checks/types.js"

/**
 * ENG-003 — command/analyzer execution safety.
 *
 * Pinned invariants for `--allow-commands` opt-in surface:
 *  - Without the flag, command checks short-circuit to NOT_APPLICABLE.
 *  - With the flag, timeouts are enforced and surfaced in evidence.
 *  - Working-directory override is resolved relative to cwd; absolute
 *    escape paths land on the literal resolved path (no chroot — pinning
 *    current behaviour so future hardening is a deliberate change).
 *  - Env allowlist is enforced: secrets-style variables are stripped
 *    unless explicitly opted in via `env_allowlist`.
 *  - The runner currently invokes `/bin/sh -c <run>`, which DOES interpret
 *    shell metacharacters. Tests below pin that contract so any future move
 *    to `spawnSync` without `sh -c` is a deliberate breaking change.
 */

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "rulebound-cmd-safety-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function withCheck(check: CommandCheck, opts: { allow?: boolean; extra?: readonly string[] } = {}) {
  return runCommandCheck({
    cwd: tmpDir,
    ruleId: "test.rule",
    check,
    allowCommandExecution: opts.allow ?? true,
    ...(opts.extra ? { extraEnvAllowlist: opts.extra } : {}),
  })
}

describe("Opt-in gating", () => {
  it("returns NOT_APPLICABLE with --allow-commands hint when flag is off", () => {
    const result = runCommandCheck({
      cwd: tmpDir,
      ruleId: "test.rule",
      check: { type: "command", run: "echo nope" },
      allowCommandExecution: false,
    })
    expect(result.status).toBe("NOT_APPLICABLE")
    expect(result.blocking).toBe(false)
    expect(result.reason).toMatch(/--allow-commands/)
  })

  it("analyzer with run= also requires --allow-commands", () => {
    const result = runAnalyzerCheck({
      cwd: tmpDir,
      ruleId: "test.rule",
      allowCommandExecution: false,
      check: {
        type: "analyzer",
        analyzer: "pmd",
        run: "mvn pmd:check",
        report: "target/pmd.xml",
        report_format: "pmd-xml",
      },
    })
    expect(result.status).toBe("NOT_APPLICABLE")
    expect(result.reason).toMatch(/--allow-commands/)
  })
})

describe("Timeout enforcement", () => {
  it("kills runaway commands well before they finish naturally", () => {
    // sleep 5s under a 100ms timeout — must terminate well before the test runner's own timeout.
    const start = Date.now()
    const result = withCheck({
      type: "command",
      run: "sleep 5",
      timeout_ms: 100,
    })
    const elapsedMs = Date.now() - start

    // spawnSync timeout: result.error is set (ETIMEDOUT). The runner maps that
    // to ERROR (non-blocking) — NOT VIOLATED. Pinning that contract here so
    // future changes (e.g. mapping timeouts to blocking violations) are
    // deliberate.
    expect(result.status).toBe("ERROR")
    expect(result.blocking).toBe(false)
    expect(result.reason).toMatch(/failed to start|ETIMEDOUT|timed out/i)
    // We must have returned well before the 5s the command asked for.
    expect(elapsedMs).toBeLessThan(2_500)
  }, 10_000)

  it("respects the default 120s timeout when none is supplied (sanity: short command finishes)", () => {
    const result = withCheck({
      type: "command",
      run: "true",
    })
    expect(result.status).toBe("PASS")
    expect(result.evidence?.exitCode).toBe(0)
  })
})

describe("Working directory handling", () => {
  it("runs in the rule's cwd by default and can read files written there", () => {
    writeFileSync(join(tmpDir, "marker.txt"), "hello\n")
    const result = withCheck({
      type: "command",
      run: "cat marker.txt",
    })
    expect(result.status).toBe("PASS")
    expect(result.evidence?.stdout).toContain("hello")
  })

  it("relative cwd override is resolved against the rule cwd", () => {
    mkdirSync(join(tmpDir, "nested"), { recursive: true })
    writeFileSync(join(tmpDir, "nested", "inside.txt"), "inside\n")
    const result = withCheck({
      type: "command",
      run: "cat inside.txt",
      cwd: "nested",
    })
    expect(result.status).toBe("PASS")
    expect(result.evidence?.stdout).toContain("inside")
  })

  it("absolute cwd escape: pinning current resolved-path behaviour", () => {
    // Today: workingDir = new URL(check.cwd, `file://${cwd}/`).pathname.
    // An absolute path like "/" parses as a URL absolute path, NOT joined
    // against cwd. We *pin* this so any future hardening (reject absolute,
    // confine to cwd) is a deliberate, reviewed change.
    const result = withCheck({
      type: "command",
      run: "pwd",
      cwd: "/",
    })
    // Should still execute — but in `/`, not in tmpDir.
    expect(result.status).toBe("PASS")
    expect((result.evidence?.stdout ?? "").trim()).toBe("/")
  })

  it("a non-existent relative cwd surfaces an ERROR with a startup failure reason", () => {
    const result = withCheck({
      type: "command",
      run: "true",
      cwd: "does/not/exist",
    })
    expect(result.status).toBe("ERROR")
    expect(result.reason).toMatch(/failed to start|ENOENT/i)
  })
})

describe("Environment allow/deny", () => {
  // We seed process.env with a known secret-like variable before each spawn,
  // then verify whether the child sees it. The runner builds a tight env
  // allowlist from DEFAULT_ENV_ALLOWLIST + check.env_allowlist + extraEnvAllowlist.

  const SECRET_KEY = "RULEBOUND_TEST_SECRET_DO_NOT_LEAK"
  const SECRET_VAL = "tokenA-zxcvb"

  beforeEach(() => {
    process.env[SECRET_KEY] = SECRET_VAL
  })

  afterEach(() => {
    delete process.env[SECRET_KEY]
  })

  it("non-allowlisted env vars are stripped from the child process", () => {
    const result = withCheck({
      type: "command",
      run: `node -e "console.log(process.env.${SECRET_KEY} ?? 'absent')"`,
    })
    expect(result.status).toBe("PASS")
    expect(result.evidence?.stdout).toContain("absent")
    expect(result.evidence?.stdout).not.toContain(SECRET_VAL)
  })

  it("env_allowlist on the check passes through the named variable", () => {
    const result = withCheck({
      type: "command",
      run: `node -e "console.log(process.env.${SECRET_KEY} ?? 'absent')"`,
      env_allowlist: [SECRET_KEY],
    })
    expect(result.status).toBe("PASS")
    expect(result.evidence?.stdout).toContain(SECRET_VAL)
  })

  it("inline check.env overrides take precedence", () => {
    const result = withCheck({
      type: "command",
      run: `node -e "console.log(process.env.OVERRIDE_KEY)"`,
      env: { OVERRIDE_KEY: "from-rule" },
    })
    expect(result.status).toBe("PASS")
    expect(result.evidence?.stdout).toContain("from-rule")
  })

  it("PATH is always forwarded so child can find node/sh", () => {
    const result = withCheck({
      type: "command",
      run: `node -e "console.log(typeof process.env.PATH)"`,
    })
    expect(result.status).toBe("PASS")
    expect(result.evidence?.stdout).toContain("string")
  })
})

describe("Shell-interpretation invariant", () => {
  /**
   * The runner uses `spawnSync("/bin/sh", ["-c", check.run], ...)`. That
   * means shell metacharacters ARE interpreted. Rules authors must treat
   * `run:` as a shell string, not as argv. These tests pin that contract.
   *
   * If a future refactor switches to argv-style spawn (no shell), these
   * tests will fail loudly — which is the intended signal that the
   * configuration surface changed.
   */

  it("shell metacharacters are interpreted (pipe works)", () => {
    const result = withCheck({
      type: "command",
      run: "echo hello | tr a-z A-Z",
    })
    expect(result.status).toBe("PASS")
    expect((result.evidence?.stdout ?? "").trim()).toBe("HELLO")
  })

  it("shell glob expansion is interpreted", () => {
    writeFileSync(join(tmpDir, "a.txt"), "one\n")
    writeFileSync(join(tmpDir, "b.txt"), "two\n")
    const result = withCheck({
      type: "command",
      run: "cat *.txt | wc -l",
    })
    expect(result.status).toBe("PASS")
    // Two single-line files → 2 lines.
    expect(parseInt((result.evidence?.stdout ?? "0").trim(), 10)).toBe(2)
  })

  it("non-zero exit from a non-allowlisted code becomes VIOLATED+blocking", () => {
    const result = withCheck({
      type: "command",
      run: "exit 17",
    })
    expect(result.status).toBe("VIOLATED")
    expect(result.evidence?.exitCode).toBe(17)
    expect(result.blocking).toBe(true)
  })

  it("pass_exit_codes accepts a non-zero code as success", () => {
    const result = withCheck({
      type: "command",
      run: "exit 2",
      pass_exit_codes: [0, 2],
    })
    expect(result.status).toBe("PASS")
    expect(result.evidence?.exitCode).toBe(2)
  })

  it("stdout/stderr are captured and truncated, never written to host fs by the runner itself", () => {
    // Build a side-effect canary: if the runner did NOT use shell, "> sentinel"
    // would be passed as a literal argv token (no file created). Since the
    // runner DOES use sh -c, the redirect runs and we'd see the file.
    // This is the same invariant as above, framed from the side-effect angle.
    const sentinel = join(tmpDir, "sentinel.txt")
    const result = withCheck({
      type: "command",
      run: `printf 'captured\\n'; echo redirected > ${sentinel}`,
    })
    expect(result.status).toBe("PASS")
    expect(result.evidence?.stdout).toContain("captured")
    expect(existsSync(sentinel)).toBe(true)
    expect(readFileSync(sentinel, "utf-8")).toContain("redirected")
  })
})
