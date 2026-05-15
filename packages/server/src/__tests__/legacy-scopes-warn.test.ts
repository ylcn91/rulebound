import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { warnLegacyTokenScopesEnv } from "../startup-checks.js"

// These tests assert the boot-time deprecation warn fires once when
// RULEBOUND_LEGACY_TOKEN_SCOPES=1 is set. The warn mirrors the per-request
// deprecation log emitted by middleware/require-scope.ts so that operators
// see the deprecation signal at boot even if no request ever hits a guarded
// route. Removal milestone is documented in
// packages/server/docs/scope-taxonomy.md (v0.3.0 turns the env into a no-op,
// v0.4.0 drops the legacy string mapping).

describe("warnLegacyTokenScopesEnv", () => {
  const stderr: string[] = []
  let writeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stderr.length = 0
    writeSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stderr.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString())
        return true
      })
  })

  afterEach(() => {
    writeSpy.mockRestore()
  })

  it("emits a single warn line when RULEBOUND_LEGACY_TOKEN_SCOPES=1", () => {
    const fired = warnLegacyTokenScopesEnv({
      env: {
        RULEBOUND_LEGACY_TOKEN_SCOPES: "1",
      } as NodeJS.ProcessEnv,
    })

    expect(fired).toBe(true)
    expect(stderr).toHaveLength(1)

    const line = stderr[0]!
    expect(line).toContain("RULEBOUND_LEGACY_TOKEN_SCOPES=1")
    expect(line).toContain("v0.3.0")
    expect(line).toMatch(/"level":"warn"/)
  })

  it("does not warn when the env is unset", () => {
    const fired = warnLegacyTokenScopesEnv({
      env: {} as NodeJS.ProcessEnv,
    })

    expect(fired).toBe(false)
    expect(stderr).toHaveLength(0)
  })

  it("does not warn for values other than the literal '1'", () => {
    for (const value of ["0", "true", "yes", ""]) {
      stderr.length = 0
      const fired = warnLegacyTokenScopesEnv({
        env: {
          RULEBOUND_LEGACY_TOKEN_SCOPES: value,
        } as NodeJS.ProcessEnv,
      })
      expect(fired, `value=${JSON.stringify(value)}`).toBe(false)
      expect(stderr).toHaveLength(0)
    }
  })
})
