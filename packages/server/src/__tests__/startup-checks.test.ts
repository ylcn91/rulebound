import { describe, it, expect } from "vitest"
import { validateServerEnv } from "../startup-checks.js"

const VALID_HEX_KEY = "0".repeat(64)

describe("validateServerEnv", () => {
  it("throws when DATABASE_URL is missing", () => {
    expect(() =>
      validateServerEnv({
        env: {
          RULEBOUND_ENCRYPTION_KEY: VALID_HEX_KEY,
        } as NodeJS.ProcessEnv,
      }),
    ).toThrowError(/DATABASE_URL/)
  })

  it("throws when RULEBOUND_ENCRYPTION_KEY is malformed", () => {
    expect(() =>
      validateServerEnv({
        env: {
          DATABASE_URL: "postgres://user:pass@localhost:5432/rulebound",
          RULEBOUND_ENCRYPTION_KEY: "too-short",
        } as NodeJS.ProcessEnv,
      }),
    ).toThrowError(/RULEBOUND_ENCRYPTION_KEY/)
  })

  it("returns parsed env when all required vars are present and valid", () => {
    const result = validateServerEnv({
      env: {
        DATABASE_URL: "postgres://user:pass@localhost:5432/rulebound",
        RULEBOUND_ENCRYPTION_KEY: VALID_HEX_KEY,
      } as NodeJS.ProcessEnv,
    })

    expect(result.DATABASE_URL).toContain("postgres://")
    expect(result.RULEBOUND_ENCRYPTION_KEY).toHaveLength(64)
  })
})
