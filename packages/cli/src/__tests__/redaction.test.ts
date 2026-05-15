/**
 * SEC-004 — CLI redaction parity.
 *
 * Verifies that machine-readable check outputs (`--format json`,
 * `--format repair-json`, `--format sarif`) do not echo common secret
 * patterns out of `evidence.snippet`.
 *
 * Current CLI behavior: before this test, snippets were emitted verbatim
 * (e.g. `evidence.snippet: "Authorization: Bearer sk-live-XYZ..."`).
 * That is a real leak risk for CI logs and agent transcripts. The wired
 * `lib/redact-snippet.ts` utility now scrubs Bearer tokens, password=
 * inline forms, AWS access key IDs, and GitHub PATs before printing.
 *
 * This file pins the contract at the unit level. Full deterministic-report
 * integration is exercised by the `redactReportSnippets()` helper test
 * below using a synthetic report — no real engine run is needed.
 */
import { describe, expect, it } from "vitest"
import { redactReportSnippets, redactSnippet } from "../lib/redact-snippet.js"

describe("redactSnippet", () => {
  it("redacts Authorization: Bearer <token>", () => {
    const input = `Authorization: Bearer sk-live-must-not-leak-001`
    const out = redactSnippet(input)
    expect(out).not.toContain("sk-live-must-not-leak-001")
    expect(out).toContain("[REDACTED]")
    expect(out).toContain("Bearer")
  })

  it("redacts Authorization: Basic <token>", () => {
    const out = redactSnippet(`Authorization: Basic dXNlcjpwYXNzd29yZA==`)
    expect(out).not.toContain("dXNlcjpwYXNzd29yZA==")
    expect(out).toContain("[REDACTED]")
  })

  it("redacts inline password=, password:, password : '...' forms", () => {
    const cases = [
      `password=hunter2-must-not-leak`,
      `password: "hunter2-must-not-leak"`,
      `"password": "hunter2-must-not-leak"`,
      `password : 'hunter2-must-not-leak'`,
    ]
    for (const c of cases) {
      const out = redactSnippet(c)
      expect(out, `case: ${c}`).not.toContain("hunter2-must-not-leak")
      expect(out, `case: ${c}`).toContain("[REDACTED]")
    }
  })

  it("redacts api_key / apiKey / api-key forms", () => {
    const cases = [
      `api_key=must-not-leak-001`,
      `apiKey: "must-not-leak-002"`,
      `"api-key": "must-not-leak-003"`,
    ]
    for (const c of cases) {
      const out = redactSnippet(c)
      expect(out, `case: ${c}`).not.toMatch(/must-not-leak-\d+/)
      expect(out, `case: ${c}`).toContain("[REDACTED]")
    }
  })

  it("redacts token / access_token / refresh_token", () => {
    const cases = [
      `token=must-not-leak-tok-1`,
      `access_token: "must-not-leak-tok-2"`,
      `refresh_token = 'must-not-leak-tok-3'`,
    ]
    for (const c of cases) {
      const out = redactSnippet(c)
      expect(out, `case: ${c}`).not.toMatch(/must-not-leak-tok-\d/)
      expect(out, `case: ${c}`).toContain("[REDACTED]")
    }
  })

  it("redacts secret / client_secret", () => {
    const cases = [
      `secret=must-not-leak-sec-1`,
      `client_secret: must-not-leak-sec-2`,
    ]
    for (const c of cases) {
      const out = redactSnippet(c)
      expect(out, `case: ${c}`).not.toMatch(/must-not-leak-sec-\d/)
      expect(out, `case: ${c}`).toContain("[REDACTED]")
    }
  })

  it("redacts AWS access key IDs (AKIA / ASIA prefix)", () => {
    const out = redactSnippet(`aws_creds: { keyId: AKIAIOSFODNN7EXAMPLE }`)
    expect(out).not.toContain("AKIAIOSFODNN7EXAMPLE")
    expect(out).toContain("[REDACTED]")
  })

  it("redacts GitHub PATs", () => {
    const out = redactSnippet(`x-gh-token: ghp_abcdefghijklmnopqrstuvwxyz0123456789`)
    expect(out).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123456789")
    expect(out).toContain("[REDACTED]")
  })

  it("returns undefined for undefined input (no NPE on missing snippet)", () => {
    expect(redactSnippet(undefined)).toBeUndefined()
  })

  it("preserves non-secret content verbatim", () => {
    const out = redactSnippet(`function helloWorld() { return "greeting"; }`)
    expect(out).toBe(`function helloWorld() { return "greeting"; }`)
  })

  it("is idempotent across multiple passes", () => {
    const first = redactSnippet(`Authorization: Bearer leakme`)
    const second = redactSnippet(first)
    expect(first).toEqual(second)
  })
})

describe("redactReportSnippets — applied across full deterministic report shape", () => {
  it("redacts evidence.snippet for every result that has one", () => {
    const fakeReport = {
      status: "FAILED",
      summary: { pass: 0, violated: 2, notApplicable: 0, error: 0, blocking: 2, waived: 0 },
      results: [
        {
          ruleId: "secret.no-bearer",
          checkId: "no-bearer",
          status: "VIOLATED",
          blocking: true,
          source: "deterministic",
          deterministic: true,
          confidence: 1,
          reason: "Authorization header leaked",
          evidence: {
            filePath: "src/foo.ts",
            line: 12,
            snippet: `headers: { Authorization: "Bearer must-not-leak-report-1" }`,
          },
        },
        {
          ruleId: "secret.no-inline-password",
          checkId: "no-inline-password",
          status: "VIOLATED",
          blocking: true,
          source: "deterministic",
          deterministic: true,
          confidence: 1,
          reason: "inline password",
          evidence: {
            filePath: "src/bar.ts",
            line: 7,
            snippet: `const cfg = { password: "hunter2-must-not-leak-report-2" }`,
          },
        },
        // Result with no evidence at all — must be passed through untouched.
        {
          ruleId: "no-evidence-rule",
          checkId: "x",
          status: "VIOLATED",
          blocking: false,
          source: "advisory",
          deterministic: false,
          confidence: 0.5,
          reason: "x",
        },
      ],
      parseErrors: [],
      waiversApplied: [],
    }

    const out = redactReportSnippets(fakeReport)
    const serialized = JSON.stringify(out)

    expect(serialized).not.toContain("must-not-leak-report-1")
    expect(serialized).not.toContain("must-not-leak-report-2")
    expect(serialized).toContain("[REDACTED]")
    // File paths and line numbers are preserved.
    expect(serialized).toContain("src/foo.ts")
    expect(serialized).toContain("src/bar.ts")
    // The no-evidence result is preserved (no crash on missing evidence field).
    expect(serialized).toContain("no-evidence-rule")
  })

  it("does not mutate the input report", () => {
    const input = {
      results: [
        { evidence: { snippet: `Authorization: Bearer original-token` } },
      ],
    }
    const copy = JSON.parse(JSON.stringify(input))
    redactReportSnippets(input)
    expect(input).toEqual(copy)
  })
})
