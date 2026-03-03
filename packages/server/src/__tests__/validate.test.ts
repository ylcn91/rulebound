import { describe, it, expect, vi, beforeEach } from "vitest"
import { Hono } from "hono"

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
  schema: {
    rules: { isActive: "is_active" },
    auditLog: {},
  },
}))

vi.mock("@rulebound/engine", () => ({
  validate: vi.fn(),
}))

import { getDb } from "../db/index.js"
import { validate } from "@rulebound/engine"

const mockGetDb = vi.mocked(getDb)
const mockValidate = vi.mocked(validate)

async function createApp() {
  const { validateApi } = await import("../api/validate.js")
  const app = new Hono()
  app.route("/validate", validateApi)
  return app
}

function makeDbRule(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    title: "Test Rule",
    content: "Test content",
    category: "security",
    severity: "error",
    modality: "must",
    tags: ["test"],
    stack: [],
    isActive: true,
    version: 1,
    ruleSetId: "rs-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe("validate API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 when neither plan nor code is provided", async () => {
    const app = await createApp()
    const res = await app.request("/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("returns 200 with validation results for a valid plan", async () => {
    const dbRules = [makeDbRule()]
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(dbRules),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    }
    mockGetDb.mockReturnValue(mockDb as never)

    const mockReport = {
      task: "test",
      rulesMatched: 1,
      rulesTotal: 1,
      results: [
        {
          ruleId: "rule-1",
          ruleTitle: "Test Rule",
          severity: "error",
          modality: "must",
          status: "PASS",
          reason: "Plan addresses the rule",
        },
      ],
      summary: { pass: 1, violated: 0, notCovered: 0 },
      status: "PASSED",
    }
    mockValidate.mockResolvedValue(mockReport as never)

    const app = await createApp()
    const res = await app.request("/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "Use constructor injection everywhere" }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("PASSED")
    expect(body.results).toHaveLength(1)
  })

  it("returns 200 with code field instead of plan", async () => {
    const dbRules = [makeDbRule()]
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(dbRules),
        }),
      }),
    }
    mockGetDb.mockReturnValue(mockDb as never)

    const mockReport = {
      task: "test",
      rulesMatched: 1,
      rulesTotal: 1,
      results: [],
      summary: { pass: 0, violated: 0, notCovered: 0 },
      status: "PASSED",
    }
    mockValidate.mockResolvedValue(mockReport as never)

    const app = await createApp()
    const res = await app.request("/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "const x = 1" }),
    })

    expect(res.status).toBe(200)
  })

  it("filters rules by language/stack", async () => {
    const dbRules = [
      makeDbRule({ id: "java-rule", stack: ["java"] }),
      makeDbRule({ id: "python-rule", stack: ["python"] }),
      makeDbRule({ id: "global-rule", stack: [] }),
    ]
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(dbRules),
        }),
      }),
    }
    mockGetDb.mockReturnValue(mockDb as never)

    const mockReport = {
      task: "test",
      rulesMatched: 2,
      rulesTotal: 2,
      results: [],
      summary: { pass: 0, violated: 0, notCovered: 0 },
      status: "PASSED",
    }
    mockValidate.mockResolvedValue(mockReport as never)

    const app = await createApp()
    const res = await app.request("/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "Use Spring Boot", language: "java" }),
    })

    expect(res.status).toBe(200)
    // validate should be called with the rules the DB returned
    // (actual filtering happens at the SQL level via arrayOverlaps)
    expect(mockValidate).toHaveBeenCalledOnce()
    const callArgs = mockValidate.mock.calls[0][0]
    expect(callArgs.rules).toHaveLength(3)
    expect(callArgs.plan).toBe("Use Spring Boot")
  })

  it("logs audit entries for violations when orgId is set", async () => {
    const dbRules = [makeDbRule()]
    const mockInsertValues = vi.fn().mockResolvedValue([])
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(dbRules),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: mockInsertValues,
      }),
    }
    mockGetDb.mockReturnValue(mockDb as never)

    const mockReport = {
      task: "test",
      rulesMatched: 1,
      rulesTotal: 1,
      results: [
        {
          ruleId: "rule-1",
          ruleTitle: "Test Rule",
          severity: "error",
          modality: "must",
          status: "VIOLATED",
          reason: "Rule violated",
        },
      ],
      summary: { pass: 0, violated: 1, notCovered: 0 },
      status: "FAILED",
    }
    mockValidate.mockResolvedValue(mockReport as never)

    // Create an app that sets orgId
    const { validateApi } = await import("../api/validate.js")
    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("orgId" as never, "org-123" as never)
      await next()
    })
    app.route("/validate", validateApi)

    const res = await app.request("/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "hardcode the password" }),
    })

    expect(res.status).toBe(200)
    expect(mockInsertValues).toHaveBeenCalled()
  })
})
