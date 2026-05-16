import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { waiversListCommand } from "./waivers.js"

describe("waivers command", () => {
  let tmpDir: string
  let originalCwd: string
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalCwd = process.cwd()
    tmpDir = mkdtempSync(join(tmpdir(), "rulebound-waivers-cli-"))
    mkdirSync(join(tmpDir, ".rulebound"), { recursive: true })
    process.chdir(tmpDir)
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__EXIT__:${code ?? 0}`)
    }) as never)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tmpDir, { recursive: true, force: true })
    logSpy.mockRestore()
    errSpy.mockRestore()
    exitSpy.mockRestore()
  })

  function writeWaivers(body: string): void {
    writeFileSync(join(tmpDir, ".rulebound", "waivers.yaml"), body)
  }

  function output(): string {
    return logSpy.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n")
  }

  it("prints waiver lifecycle as json", async () => {
    writeWaivers(`waivers:
  - rule: old.rule
    reason: expired cleanup
    owner: "@team"
    expires: "2000-01-01"
  - rule: future.rule
    check: regex:todo
    reason: planned cleanup
    owner: "@team"
    expires: "2099-01-01"
    scope: ["src/legacy/**"]
`)

    await waiversListCommand({ format: "json", expiringWithin: "30" })

    const parsed = JSON.parse(output())
    expect(parsed.status).toBe("fail")
    expect(parsed.total).toBe(2)
    expect(parsed.expired).toBe(1)
    expect(parsed.waivers[0]).toMatchObject({
      rule: "old.rule",
      owner: "@team",
      expired: true,
    })
    expect(parsed.waivers[1]).toMatchObject({
      rule: "future.rule",
      check: "regex:todo",
      scope: ["src/legacy/**"],
      expired: false,
    })
  })

  it("strict mode exits non-zero when waivers are expiring", async () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    writeWaivers(`waivers:
  - rule: soon.rule
    reason: remove soon
    owner: "@team"
    expires: "${soon}"
`)

    await expect(waiversListCommand({ format: "json", expiringWithin: "14", strict: true }))
      .rejects.toThrow("__EXIT__:3")
  })
})
