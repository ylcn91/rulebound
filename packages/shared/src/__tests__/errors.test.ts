import { describe, expect, it } from "vitest"
import { isRuleboundError, type RuleboundError } from "../errors.js"

describe("RuleboundError envelope", () => {
  it("accepts the minimal canonical shape", () => {
    const env: RuleboundError = {
      error: "error",
      code: "unauthorized",
      message: "Missing or invalid API token.",
    }
    expect(isRuleboundError(env)).toBe(true)
  })

  it("accepts the full canonical shape with details and retriable", () => {
    const env: RuleboundError = {
      error: "error",
      code: "validation_failed",
      message: "Request body did not match the expected schema.",
      details: { fields: { name: "required" } },
      retriable: false,
    }
    expect(isRuleboundError(env)).toBe(true)
  })

  it("treats retriable=true as a valid envelope", () => {
    const env: RuleboundError = {
      error: "error",
      code: "rate_limited",
      message: "Too many requests. Retry after backoff.",
      retriable: true,
    }
    expect(isRuleboundError(env)).toBe(true)
  })

  it("rejects payloads missing required fields", () => {
    expect(isRuleboundError({ error: "error", code: "x" })).toBe(false)
    expect(isRuleboundError({ code: "x", message: "y" })).toBe(false)
    expect(isRuleboundError({ error: "error", message: "y" })).toBe(false)
  })

  it("rejects non-object inputs", () => {
    expect(isRuleboundError(null)).toBe(false)
    expect(isRuleboundError(undefined)).toBe(false)
    expect(isRuleboundError("error")).toBe(false)
    expect(isRuleboundError(42)).toBe(false)
    expect(isRuleboundError([])).toBe(false)
  })

  it("rejects envelopes with wrong field types", () => {
    expect(
      isRuleboundError({ error: 1, code: "x", message: "y" }),
    ).toBe(false)
    expect(
      isRuleboundError({ error: "error", code: 1, message: "y" }),
    ).toBe(false)
    expect(
      isRuleboundError({ error: "error", code: "x", message: 1 }),
    ).toBe(false)
  })

  it("round-trips through JSON.stringify/parse without losing fields", () => {
    const env: RuleboundError = {
      error: "error",
      code: "not_found",
      message: "Resource not found.",
      details: { id: "abc-123" },
      retriable: false,
    }
    const wire = JSON.stringify(env)
    const parsed = JSON.parse(wire) as unknown
    expect(isRuleboundError(parsed)).toBe(true)
    expect(parsed).toEqual(env)
  })

  it("simulates the SDK client parse path — non-JSON body falls back gracefully", () => {
    // The SDK client receives a raw response.text() body. If it is JSON and
    // matches the envelope, the structured fields are surfaced. If not, the
    // SDK falls back to the raw body string.
    const parseEnvelope = (body: string): RuleboundError | null => {
      try {
        const parsed = JSON.parse(body) as unknown
        if (isRuleboundError(parsed)) return parsed
        // Server "validation_failed" responses today wrap the envelope:
        // `{ error: { message, code, ... } }`. Accept that nested shape too
        // for the duration of CLN-003 server-side rollout.
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          const nested = (parsed as { error: unknown }).error
          if (isRuleboundError(nested)) return nested
        }
        return null
      } catch {
        return null
      }
    }

    expect(
      parseEnvelope(
        JSON.stringify({
          error: "error",
          code: "forbidden",
          message: "Token lacks required scope.",
        }),
      ),
    ).toEqual({
      error: "error",
      code: "forbidden",
      message: "Token lacks required scope.",
    })

    expect(parseEnvelope("plain text body")).toBeNull()
    expect(parseEnvelope("")).toBeNull()
  })

  it("preserves an unknown details payload as-is", () => {
    const env: RuleboundError = {
      error: "error",
      code: "rule_violation",
      message: "Code block violates a project rule.",
      details: {
        type: "rulebound_violation",
        violations: [
          { ruleId: "r1", ruleTitle: "No eval", severity: "error" },
        ],
      },
    }
    expect(isRuleboundError(env)).toBe(true)
    // details is structurally opaque — caller is responsible for shape.
    expect(env.details).toMatchObject({ type: "rulebound_violation" })
  })
})
