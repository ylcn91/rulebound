import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  DEFAULT_REDACTED_KEYS,
  redactAuditMetadata,
} from "../lib/audit-redaction.js"
import {
  pruneAuditEntries,
  renderAuditCsv,
  resolveRetentionDays,
  listAuditEntries,
} from "../lib/audit.js"
import { schema } from "../db/index.js"

describe("redactAuditMetadata", () => {
  it("returns primitives unchanged", () => {
    expect(redactAuditMetadata(null)).toBeNull()
    expect(redactAuditMetadata(undefined)).toBeUndefined()
    expect(redactAuditMetadata(42)).toBe(42)
    expect(redactAuditMetadata("plain")).toBe("plain")
    expect(redactAuditMetadata(true)).toBe(true)
  })

  it("redacts denied top-level keys", () => {
    expect(
      redactAuditMetadata({
        token: "abc123",
        secret: "shh",
        password: "hunter2",
        email: "user@example.com",
        ip: "10.0.0.1",
        safe: "keep",
      }),
    ).toEqual({
      token: "[REDACTED]",
      secret: "[REDACTED]",
      password: "[REDACTED]",
      email: "[REDACTED]",
      ip: "[REDACTED]",
      safe: "keep",
    })
  })

  it("is case-insensitive", () => {
    expect(
      redactAuditMetadata({
        TOKEN: "x",
        Email: "y",
        IP_ADDRESS: "z",
      }),
    ).toEqual({
      TOKEN: "[REDACTED]",
      Email: "[REDACTED]",
      IP_ADDRESS: "[REDACTED]",
    })
  })

  it("matches embedded key names", () => {
    expect(
      redactAuditMetadata({
        userEmail: "x",
        clientSecretV2: "y",
        apiToken: "z",
      }),
    ).toEqual({
      userEmail: "[REDACTED]",
      clientSecretV2: "[REDACTED]",
      apiToken: "[REDACTED]",
    })
  })

  it("recurses into nested objects", () => {
    expect(
      redactAuditMetadata({
        outer: {
          inner: {
            token: "leak",
            value: 1,
          },
        },
      }),
    ).toEqual({
      outer: {
        inner: {
          token: "[REDACTED]",
          value: 1,
        },
      },
    })
  })

  it("recurses element-by-element through arrays of objects", () => {
    expect(
      redactAuditMetadata({
        events: [
          { kind: "x", token: "1" },
          { kind: "y", token: "2" },
        ],
      }),
    ).toEqual({
      events: [
        { kind: "x", token: "[REDACTED]" },
        { kind: "y", token: "[REDACTED]" },
      ],
    })
  })

  it("does not mutate the input", () => {
    const input = { token: "leak", deep: { ip: "1.2.3.4" } }
    redactAuditMetadata(input)
    expect(input).toEqual({ token: "leak", deep: { ip: "1.2.3.4" } })
  })

  it("respects a custom key list", () => {
    expect(
      redactAuditMetadata(
        { foo: "x", bar: "y", token: "keep" },
        ["foo"],
      ),
    ).toEqual({
      foo: "[REDACTED]",
      bar: "y",
      token: "keep",
    })
  })

  it("redacts the whole subtree when the parent key is denied", () => {
    expect(
      redactAuditMetadata({
        secret: { kind: "nested", value: "leak" },
      }),
    ).toEqual({ secret: "[REDACTED]" })
  })

  it("exposes the default key list", () => {
    expect(DEFAULT_REDACTED_KEYS).toEqual([
      "token",
      "secret",
      "password",
      "email",
      "ip",
    ])
  })
})

describe("renderAuditCsv redaction wiring", () => {
  it("scrubs sensitive metadata fields in CSV output", () => {
    const csv = renderAuditCsv([
      {
        id: "a-1",
        orgId: "org-1",
        projectId: null,
        userId: "u-1",
        action: "rule.created",
        ruleId: null,
        status: "success",
        metadata: { token: "abc123", note: "ok" },
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ])
    expect(csv).toContain("[REDACTED]")
    expect(csv).not.toContain("abc123")
    expect(csv).toContain("ok")
  })
})

describe("resolveRetentionDays", () => {
  it("returns 90 by default", () => {
    expect(resolveRetentionDays({})).toBe(90)
  })

  it("returns the parsed value", () => {
    expect(
      resolveRetentionDays({ RULEBOUND_AUDIT_RETENTION_DAYS: "30" }),
    ).toBe(30)
  })

  it("returns 0 for forever retention", () => {
    expect(
      resolveRetentionDays({ RULEBOUND_AUDIT_RETENTION_DAYS: "0" }),
    ).toBe(0)
  })

  it("falls back to default on invalid input", () => {
    expect(
      resolveRetentionDays({ RULEBOUND_AUDIT_RETENTION_DAYS: "abc" }),
    ).toBe(90)
    expect(
      resolveRetentionDays({ RULEBOUND_AUDIT_RETENTION_DAYS: "-3" }),
    ).toBe(90)
  })
})

interface DeleteCall {
  table: unknown
  conditions: unknown[]
  returnedIds: string[]
}

function makeMockDb(rowsToDelete: number) {
  const calls: DeleteCall[] = []
  const db = {
    delete: vi.fn().mockImplementation((table: unknown) => {
      const conditions: unknown[] = []
      const chain = {
        where: vi.fn().mockImplementation((cond: unknown) => {
          conditions.push(cond)
          return {
            returning: vi.fn().mockImplementation(() => {
              const ids = Array.from({ length: rowsToDelete }, (_, i) => `id-${i}`)
              calls.push({ table, conditions, returnedIds: ids })
              return Promise.resolve(ids.map((id) => ({ id })))
            }),
          }
        }),
      }
      return chain
    }),
  }
  return { db, calls }
}

describe("pruneAuditEntries", () => {
  const originalEnv = process.env.RULEBOUND_AUDIT_RETENTION_DAYS

  beforeEach(() => {
    delete process.env.RULEBOUND_AUDIT_RETENTION_DAYS
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RULEBOUND_AUDIT_RETENTION_DAYS
    } else {
      process.env.RULEBOUND_AUDIT_RETENTION_DAYS = originalEnv
    }
  })

  it("computes the cutoff from the configured window", async () => {
    const { db } = makeMockDb(3)
    const fixedNow = new Date("2026-05-15T00:00:00Z")
    const result = await pruneAuditEntries(db as never, {
      retentionDays: 30,
      now: () => fixedNow,
    })
    expect(result.skipped).toBe(false)
    expect(result.deleted).toBe(3)
    // 30 days before fixedNow
    expect(result.cutoff.toISOString()).toBe("2026-04-15T00:00:00.000Z")
  })

  it("returns deleted: 0 when nothing is older than the cutoff", async () => {
    const { db } = makeMockDb(0)
    const result = await pruneAuditEntries(db as never, {
      retentionDays: 30,
      now: () => new Date("2026-05-15T00:00:00Z"),
    })
    expect(result.deleted).toBe(0)
    expect(result.skipped).toBe(false)
  })

  it("skips the delete when retentionDays is 0", async () => {
    const { db } = makeMockDb(99)
    const result = await pruneAuditEntries(db as never, { retentionDays: 0 })
    expect(result.skipped).toBe(true)
    expect(result.deleted).toBe(0)
    expect(db.delete).not.toHaveBeenCalled()
  })

  it("falls back to env config when no explicit retentionDays passed", async () => {
    process.env.RULEBOUND_AUDIT_RETENTION_DAYS = "7"
    const { db } = makeMockDb(1)
    const fixedNow = new Date("2026-05-15T00:00:00Z")
    const result = await pruneAuditEntries(db as never, { now: () => fixedNow })
    expect(result.cutoff.toISOString()).toBe("2026-05-08T00:00:00.000Z")
  })

  it("targets the audit_log table", async () => {
    const { db, calls } = makeMockDb(0)
    await pruneAuditEntries(db as never, {
      retentionDays: 30,
      now: () => new Date("2026-05-15T00:00:00Z"),
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].table).toBe(schema.auditLog)
  })
})

describe("listAuditEntries redaction wiring", () => {
  it("redacts metadata returned by the database before handing it to callers", async () => {
    const sensitive = {
      id: "a-1",
      orgId: "org-1",
      projectId: null,
      userId: "u-1",
      action: "rule.created",
      ruleId: null,
      status: "success",
      metadata: { email: "user@example.com", note: "ok" },
      createdAt: new Date(),
    }
    // Mock the select chain. orderBy → limit → offset returns the rows.
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve([sensitive]),
              }),
            }),
          }),
        }),
      }),
    }
    const result = await listAuditEntries(db as never, "org-1", {})
    expect(result).toHaveLength(1)
    expect((result[0].metadata as Record<string, unknown>).email).toBe(
      "[REDACTED]",
    )
    expect((result[0].metadata as Record<string, unknown>).note).toBe("ok")
  })
})
