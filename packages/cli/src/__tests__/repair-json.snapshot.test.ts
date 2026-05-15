import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { checkCommand, type CheckOptions } from "../commands/check.js"

/**
 * CLI-005 — repair-json shape snapshot.
 *
 * Pins the stable contract documented in docs/repair-json-schema.md.
 * Any field rename / shape change must update both the doc and this test
 * in the same commit.
 *
 * The snapshot uses *behavioural* assertions (not full toMatchSnapshot)
 * because environment-dependent values (tmpDir paths, redacted snippets,
 * etc.) would force noisy churn. The fields we lock down are the ones
 * agents anchor on: status, summary keys, failure keys, rerun shape, next.
 */

describe("repair-json snapshot contract", () => {
  let tmpDir: string
  let originalCwd: string
  let exitSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalCwd = process.cwd()
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-repair-snap-"))
    mkdirSync(join(tmpDir, ".rulebound", "rules"), { recursive: true })
    process.chdir(tmpDir)

    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__EXIT__:${code ?? 0}`)
    }) as never)
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tmpDir, { recursive: true, force: true })
    exitSpy.mockRestore()
    logSpy.mockRestore()
    errSpy.mockRestore()
  })

  function writeRule(file: string, body: string): void {
    writeFileSync(join(tmpDir, ".rulebound", "rules", file), body)
  }

  async function runRepair(opts: CheckOptions = {}): Promise<{ code: number; payload: unknown }> {
    let code = -1
    try {
      await checkCommand({ format: "repair-json", ...opts })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const m = msg.match(/__EXIT__:(\d+)/)
      if (m) code = Number(m[1])
      else throw e
    }
    const stdout = logSpy.mock.calls.map((c: unknown[]) => c.join(" ")).join("\n")
    return { code, payload: JSON.parse(stdout) }
  }

  it("top-level shape: status / summary / failures / waived / expiredWaivers / next", async () => {
    writeRule(
      "missing.md",
      `---
title: Missing thing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    const { code, payload } = await runRepair()
    expect(code).toBe(1)
    const obj = payload as Record<string, unknown>
    expect(Object.keys(obj).sort()).toEqual(
      ["expiredWaivers", "failures", "next", "status", "summary", "waived"].sort(),
    )
    expect(obj.status).toBe("FAILED")
    expect(obj.next).toBe("Apply smallest fix per failure, rerun the same check.")
  })

  it("summary keys are stable (engine summary verbatim)", async () => {
    writeRule(
      "missing.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
---
`,
    )
    const { payload } = await runRepair()
    const summary = (payload as { summary: Record<string, unknown> }).summary
    expect(Object.keys(summary).sort()).toEqual(
      ["blocking", "error", "notApplicable", "pass", "total", "violated", "waived"].sort(),
    )
    for (const v of Object.values(summary)) expect(typeof v).toBe("number")
  })

  it("failure item shape: ruleId, checkId, source, file?, line?, evidence?, reason, suggestedFix?, rerun", async () => {
    writeRule(
      "missing.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    const { payload } = await runRepair()
    const failures = (payload as { failures: Record<string, unknown>[] }).failures
    expect(failures).toHaveLength(1)
    const f = failures[0]
    // Required fields.
    expect(typeof f.ruleId).toBe("string")
    expect(typeof f.checkId).toBe("string")
    expect(typeof f.source).toBe("string")
    expect(typeof f.reason).toBe("string")
    expect(typeof f.rerun).toBe("string")
    // No extraneous fields.
    const allowed = new Set([
      "ruleId",
      "checkId",
      "source",
      "file",
      "line",
      "evidence",
      "reason",
      "suggestedFix",
      "rerun",
    ])
    for (const key of Object.keys(f)) {
      expect(allowed.has(key), `unexpected key '${key}' on RepairItem`).toBe(true)
    }
  })

  it("rerun hint without --allow-commands is exactly 'rulebound check --format repair-json'", async () => {
    writeRule(
      "missing.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    const { payload } = await runRepair()
    const f = (payload as { failures: { rerun: string }[] }).failures[0]
    expect(f.rerun).toBe("rulebound check --format repair-json")
  })

  it("rerun hint with --allow-commands threads the flag", async () => {
    writeRule(
      "missing.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    const { payload } = await runRepair({ allowCommands: true })
    const f = (payload as { failures: { rerun: string }[] }).failures[0]
    expect(f.rerun).toBe("rulebound check --allow-commands --format repair-json")
  })

  it("waived items go to waived[] (not failures[]) with documented keys", async () => {
    writeRule(
      "missing.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: missing
    reason: "documented exception"
    owner: "@alice"
    expires: "2099-01-01"
`,
    )
    const { code, payload } = await runRepair()
    expect(code).toBe(0)
    const obj = payload as { failures: unknown[]; waived: Record<string, unknown>[] }
    expect(obj.failures).toEqual([])
    expect(obj.waived).toHaveLength(1)
    const w = obj.waived[0]
    expect(w.ruleId).toBe("missing")
    expect(w.waiverReason).toBe("documented exception")
    expect(w.expires).toBe("2099-01-01")
    // No extraneous keys on WaivedItem.
    const allowed = new Set(["ruleId", "checkId", "file", "line", "waiverReason", "expires"])
    for (const key of Object.keys(w)) {
      expect(allowed.has(key), `unexpected key '${key}' on WaivedItem`).toBe(true)
    }
  })

  it("expired waivers appear in expiredWaivers[] AND the rule re-blocks via failures[]", async () => {
    writeRule(
      "missing.md",
      `---
title: Missing
checks:
  - type: file-exists
    path: nope.md
    severity: error
---
`,
    )
    writeFileSync(
      join(tmpDir, ".rulebound", "waivers.yaml"),
      `waivers:
  - rule: missing
    reason: "long expired"
    owner: "@alice"
    expires: "2000-01-01"
`,
    )
    const { code, payload } = await runRepair()
    expect(code).toBe(1)
    const obj = payload as { failures: unknown[]; expiredWaivers: { rule: string; expires: string; reason: string }[] }
    expect(obj.failures).toHaveLength(1)
    expect(obj.expiredWaivers).toHaveLength(1)
    const e = obj.expiredWaivers[0]
    expect(e.rule).toBe("missing")
    expect(e.expires).toBe("2000-01-01")
    expect(e.reason).toBe("long expired")
  })

  it("GREEN path emits next='GREEN — no repair needed'", async () => {
    writeFileSync(join(tmpDir, "README.md"), "hi\n")
    writeRule(
      "ok.md",
      `---
title: README required
checks:
  - type: file-exists
    path: README.md
---
`,
    )
    const { code, payload } = await runRepair()
    expect(code).toBe(0)
    const obj = payload as { status: string; failures: unknown[]; next: string }
    expect(obj.status).toBe("PASSED")
    expect(obj.failures).toEqual([])
    expect(obj.next).toBe("GREEN — no repair needed")
  })

  it("status values are constrained to PASSED | FAILED | PASSED_WITH_WARNINGS", async () => {
    writeFileSync(join(tmpDir, "README.md"), "hi\n")
    writeRule(
      "ok.md",
      `---
title: README required
checks:
  - type: file-exists
    path: README.md
---
`,
    )
    writeRule(
      "warn.md",
      `---
title: Advisory missing
checks:
  - type: file-exists
    path: nope.md
    severity: warning
---
`,
    )
    const { code, payload } = await runRepair()
    expect(code).toBe(0)
    expect((payload as { status: string }).status).toBe("PASSED_WITH_WARNINGS")
  })
})
