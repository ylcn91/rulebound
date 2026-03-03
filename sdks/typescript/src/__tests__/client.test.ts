import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  RuleboundClient,
  RuleboundError,
  isViolated,
  getViolations,
} from "../index.js"
import type { ValidationReport, ValidationResult } from "../index.js"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

function makeSuccessResponse(data: unknown, status = 200) {
  return {
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }
}

function makeErrorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: body }),
    text: () => Promise.resolve(body),
  }
}

describe("RuleboundClient", () => {
  let client: RuleboundClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new RuleboundClient({
      apiKey: "test-api-key",
      serverUrl: "http://localhost:3001",
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("constructor", () => {
    it("uses default server URL when not provided", () => {
      const c = new RuleboundClient({ apiKey: "key" })
      // Verify by making a request and checking the URL
      mockFetch.mockResolvedValue(makeSuccessResponse({ data: [] }))
      c.getRules()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("http://localhost:3001"),
        expect.any(Object)
      )
    })

    it("strips trailing slash from server URL", () => {
      const c = new RuleboundClient({ apiKey: "key", serverUrl: "http://api.example.com/" })
      mockFetch.mockResolvedValue(makeSuccessResponse({ data: [] }))
      c.getRules()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/^http:\/\/api\.example\.com\/v1/),
        expect.any(Object)
      )
    })
  })

  describe("validate", () => {
    it("sends correct POST payload with plan", async () => {
      const mockReport: ValidationReport = {
        task: "test",
        rulesMatched: 1,
        rulesTotal: 1,
        results: [],
        summary: { pass: 1, violated: 0, notCovered: 0 },
        status: "PASSED",
      }
      mockFetch.mockResolvedValue(makeSuccessResponse(mockReport))

      const result = await client.validate({ plan: "Use DI everywhere" })

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/v1/validate",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ plan: "Use DI everywhere" }),
        })
      )
      expect(result.status).toBe("PASSED")
    })

    it("sends correct payload with code and language", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse({
        task: "test",
        rulesMatched: 0,
        rulesTotal: 0,
        results: [],
        summary: { pass: 0, violated: 0, notCovered: 0 },
        status: "PASSED",
      }))

      await client.validate({ code: "const x = 1", language: "typescript" })

      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(calledBody.code).toBe("const x = 1")
      expect(calledBody.language).toBe("typescript")
    })

    it("throws RuleboundError on API error", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(400, "Invalid request"))

      await expect(client.validate({ plan: "test" })).rejects.toThrow(RuleboundError)
      await mockFetch.mockResolvedValue(makeErrorResponse(500, "Server error"))
      try {
        await client.validate({ plan: "test" })
      } catch (err) {
        expect(err).toBeInstanceOf(RuleboundError)
        const rbError = err as RuleboundError
        expect(rbError.statusCode).toBe(500)
        expect(rbError.body).toBe("Server error")
      }
    })
  })

  describe("getRules", () => {
    it("fetches rules without filters", async () => {
      const rules = [
        { id: "r1", title: "Rule 1", category: "security" },
        { id: "r2", title: "Rule 2", category: "style" },
      ]
      mockFetch.mockResolvedValue(makeSuccessResponse({ data: rules }))

      const result = await client.getRules()

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/v1/rules",
        expect.objectContaining({ method: "GET" })
      )
      expect(result).toHaveLength(2)
    })

    it("fetches rules with stack filter", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse({ data: [] }))

      await client.getRules({ stack: "java" })

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/v1/rules?stack=java",
        expect.any(Object)
      )
    })

    it("fetches rules with multiple filters", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse({ data: [] }))

      await client.getRules({ stack: "typescript", category: "security", tag: "auth" })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("stack=typescript")
      expect(calledUrl).toContain("category=security")
      expect(calledUrl).toContain("tag=auth")
    })
  })

  describe("syncRules", () => {
    it("fetches sync data without filters", async () => {
      const syncData = {
        data: [{ id: "r1", title: "Rule 1" }],
        meta: { total: 1, versionHash: "abc123", syncedAt: "2025-01-01" },
      }
      mockFetch.mockResolvedValue(makeSuccessResponse(syncData))

      const result = await client.syncRules()

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/v1/sync",
        expect.any(Object)
      )
      expect(result.data).toHaveLength(1)
      expect(result.meta.versionHash).toBe("abc123")
    })

    it("passes stack and since filters", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse({ data: [], meta: { total: 0, versionHash: "", syncedAt: "" } }))

      await client.syncRules({ stack: "python", since: "2025-01-01" })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("stack=python")
      expect(calledUrl).toContain("since=2025-01-01")
    })
  })

  describe("getCompliance", () => {
    it("fetches compliance data for a project", async () => {
      const complianceData = {
        projectId: "proj-1",
        currentScore: 85,
        trend: [{ score: 85, passCount: 8, violatedCount: 1, notCoveredCount: 1, date: "2025-06-01" }],
      }
      mockFetch.mockResolvedValue(makeSuccessResponse({ data: complianceData }))

      const result = await client.getCompliance("proj-1")

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/v1/compliance/proj-1",
        expect.any(Object)
      )
      expect(result.currentScore).toBe(85)
      expect(result.trend).toHaveLength(1)
    })
  })

  describe("getAudit", () => {
    it("fetches audit entries without filters", async () => {
      const entries = [{ id: "a-1", action: "validation.violation" }]
      mockFetch.mockResolvedValue(makeSuccessResponse({ data: entries }))

      const result = await client.getAudit()

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/v1/audit",
        expect.any(Object)
      )
      expect(result).toHaveLength(1)
    })

    it("passes all filter parameters", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse({ data: [] }))

      await client.getAudit({
        orgId: "org-1",
        projectId: "proj-1",
        action: "rule.created",
        limit: 10,
      })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain("org_id=org-1")
      expect(calledUrl).toContain("project_id=proj-1")
      expect(calledUrl).toContain("action=rule.created")
      expect(calledUrl).toContain("limit=10")
    })
  })

  describe("error handling", () => {
    it("includes status code and body in RuleboundError", async () => {
      mockFetch.mockResolvedValue(makeErrorResponse(403, "Forbidden"))

      try {
        await client.validate({ plan: "test" })
        expect.fail("Should have thrown")
      } catch (err) {
        expect(err).toBeInstanceOf(RuleboundError)
        const rbErr = err as RuleboundError
        expect(rbErr.statusCode).toBe(403)
        expect(rbErr.body).toBe("Forbidden")
        expect(rbErr.name).toBe("RuleboundError")
        expect(rbErr.message).toContain("403")
      }
    })

    it("sends User-Agent header on all requests", async () => {
      mockFetch.mockResolvedValue(makeSuccessResponse({ data: [] }))

      await client.getRules()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "rulebound-js/0.1.0",
          }),
        })
      )
    })
  })
})

describe("RuleboundError", () => {
  it("has correct name and properties", () => {
    const err = new RuleboundError("Test error", 404, "Not found")
    expect(err.name).toBe("RuleboundError")
    expect(err.message).toBe("Test error")
    expect(err.statusCode).toBe(404)
    expect(err.body).toBe("Not found")
    expect(err).toBeInstanceOf(Error)
  })

  it("works without optional parameters", () => {
    const err = new RuleboundError("Basic error")
    expect(err.statusCode).toBeUndefined()
    expect(err.body).toBeUndefined()
  })
})

describe("helper functions", () => {
  describe("isViolated", () => {
    it("returns true for FAILED status", () => {
      const report: ValidationReport = {
        task: "test",
        rulesMatched: 1,
        rulesTotal: 1,
        results: [],
        summary: { pass: 0, violated: 1, notCovered: 0 },
        status: "FAILED",
      }
      expect(isViolated(report)).toBe(true)
    })

    it("returns false for PASSED status", () => {
      const report: ValidationReport = {
        task: "test",
        rulesMatched: 1,
        rulesTotal: 1,
        results: [],
        summary: { pass: 1, violated: 0, notCovered: 0 },
        status: "PASSED",
      }
      expect(isViolated(report)).toBe(false)
    })

    it("returns false for PASSED_WITH_WARNINGS status", () => {
      const report: ValidationReport = {
        task: "test",
        rulesMatched: 1,
        rulesTotal: 1,
        results: [],
        summary: { pass: 0, violated: 0, notCovered: 1 },
        status: "PASSED_WITH_WARNINGS",
      }
      expect(isViolated(report)).toBe(false)
    })
  })

  describe("getViolations", () => {
    it("returns only violated results", () => {
      const results: ValidationResult[] = [
        { ruleId: "r1", ruleTitle: "Rule 1", severity: "error", modality: "must", status: "VIOLATED", reason: "Bad" },
        { ruleId: "r2", ruleTitle: "Rule 2", severity: "warning", modality: "should", status: "PASS", reason: "Good" },
        { ruleId: "r3", ruleTitle: "Rule 3", severity: "info", modality: "may", status: "NOT_COVERED", reason: "N/A" },
        { ruleId: "r4", ruleTitle: "Rule 4", severity: "error", modality: "must", status: "VIOLATED", reason: "Also bad" },
      ]
      const report: ValidationReport = {
        task: "test",
        rulesMatched: 3,
        rulesTotal: 4,
        results,
        summary: { pass: 1, violated: 2, notCovered: 1 },
        status: "FAILED",
      }
      const violations = getViolations(report)
      expect(violations).toHaveLength(2)
      expect(violations.every((v) => v.status === "VIOLATED")).toBe(true)
    })

    it("returns empty array when no violations", () => {
      const report: ValidationReport = {
        task: "test",
        rulesMatched: 1,
        rulesTotal: 1,
        results: [
          { ruleId: "r1", ruleTitle: "Rule 1", severity: "info", modality: "may", status: "PASS", reason: "Good" },
        ],
        summary: { pass: 1, violated: 0, notCovered: 0 },
        status: "PASSED",
      }
      expect(getViolations(report)).toEqual([])
    })
  })
})
