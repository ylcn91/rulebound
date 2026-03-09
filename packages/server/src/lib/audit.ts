import { and, desc, eq, gte, lte } from "drizzle-orm"
import { getDb, schema } from "../db/index.js"
import { resolveProjectForOrg } from "./projects.js"

type Db = ReturnType<typeof getDb>

export interface AuditFilters {
  projectIdentifier?: string | null
  action?: string | null
  since?: string | null
  until?: string | null
  limit?: number
  offset?: number
}

export async function listAuditEntries(
  db: Db,
  orgId: string,
  filters: AuditFilters = {}
): Promise<typeof schema.auditLog.$inferSelect[]> {
  const conditions = [eq(schema.auditLog.orgId, orgId)]

  if (filters.projectIdentifier) {
    const project = await resolveProjectForOrg(db, orgId, filters.projectIdentifier)
    if (!project) {
      return []
    }
    conditions.push(eq(schema.auditLog.projectId, project.id))
  }

  if (filters.action) {
    conditions.push(eq(schema.auditLog.action, filters.action))
  }

  if (filters.since) {
    conditions.push(gte(schema.auditLog.createdAt, new Date(filters.since)))
  }

  if (filters.until) {
    conditions.push(lte(schema.auditLog.createdAt, new Date(filters.until)))
  }

  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  return db
    .select()
    .from(schema.auditLog)
    .where(and(...conditions))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function insertAuditEntry(
  db: Db,
  entry: typeof schema.auditLog.$inferInsert
): Promise<void> {
  await db.insert(schema.auditLog).values(entry)
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  const normalized = value instanceof Date
    ? value.toISOString()
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value)

  const escaped = normalized.replace(/"/g, "\"\"")
  return `"${escaped}"`
}

export function renderAuditCsv(entries: typeof schema.auditLog.$inferSelect[]): string {
  const headers = [
    "id",
    "orgId",
    "projectId",
    "userId",
    "action",
    "ruleId",
    "status",
    "metadata",
    "createdAt",
  ]

  const rows = entries.map((entry) => [
    entry.id,
    entry.orgId,
    entry.projectId,
    entry.userId,
    entry.action,
    entry.ruleId,
    entry.status,
    entry.metadata,
    entry.createdAt,
  ])

  return [
    headers.join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\n")
}
