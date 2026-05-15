import { and, desc, eq, gte, lt, lte } from "drizzle-orm"
import { logger } from "@rulebound/shared/logger"
import { getDb, schema } from "../db/index.js"
import { resolveProjectForOrg } from "./projects.js"
import {
  DEFAULT_REDACTED_KEYS,
  redactAuditMetadata,
} from "./audit-redaction.js"

type Db = ReturnType<typeof getDb>

type AuditEntry = typeof schema.auditLog.$inferSelect

export interface AuditFilters {
  projectIdentifier?: string | null
  action?: string | null
  since?: string | null
  until?: string | null
  limit?: number
  offset?: number
}

function redactEntries(
  entries: AuditEntry[],
  keys: readonly string[] = DEFAULT_REDACTED_KEYS,
): AuditEntry[] {
  return entries.map((entry) => ({
    ...entry,
    metadata: redactAuditMetadata(entry.metadata, keys) as AuditEntry["metadata"],
  }))
}

export async function listAuditEntries(
  db: Db,
  orgId: string,
  filters: AuditFilters = {}
): Promise<AuditEntry[]> {
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

  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(and(...conditions))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit)
    .offset(offset)

  return redactEntries(rows)
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

export function renderAuditCsv(
  entries: AuditEntry[],
  redactedKeys: readonly string[] = DEFAULT_REDACTED_KEYS,
): string {
  const redacted = redactEntries(entries, redactedKeys)
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

  const rows = redacted.map((entry) => [
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

const DEFAULT_RETENTION_DAYS = 90

export interface PruneResult {
  /** Number of rows the sweeper removed. */
  deleted: number
  /** Cutoff timestamp that was applied; rows strictly older than this were removed. */
  cutoff: Date
  /** True if retention is disabled (0 days or invalid env). No delete ran. */
  skipped: boolean
}

export interface PruneOptions {
  /** Retention window in days. Overrides env. */
  retentionDays?: number
  /** Injectable clock for deterministic tests. */
  now?: () => Date
}

/**
 * resolveRetentionDays decides the retention window from configuration. The
 * env source of truth is `RULEBOUND_AUDIT_RETENTION_DAYS`:
 *
 *   - unset / blank → DEFAULT_RETENTION_DAYS (90)
 *   - "0"            → retain forever (boot-time warning emitted)
 *   - positive int   → that many days
 *   - anything else  → DEFAULT_RETENTION_DAYS (operators see a warn line)
 */
export function resolveRetentionDays(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.RULEBOUND_AUDIT_RETENTION_DAYS
  if (raw === undefined || raw === null || raw.trim() === "") {
    return DEFAULT_RETENTION_DAYS
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    logger.warn(
      "audit_retention_invalid: ignored RULEBOUND_AUDIT_RETENTION_DAYS",
      { raw, fallback: DEFAULT_RETENTION_DAYS },
    )
    return DEFAULT_RETENTION_DAYS
  }
  if (parsed === 0) {
    logger.warn(
      "audit_retention_disabled: RULEBOUND_AUDIT_RETENTION_DAYS=0 — entries retained forever",
    )
    return 0
  }
  return parsed
}

/**
 * pruneAuditEntries deletes rows older than `retentionDays`. Returns the
 * count of deleted rows and the cutoff timestamp for observability.
 *
 * Caller wires the schedule (cron, worker, on-demand admin command). The
 * function does no locking; operators running multiple sweepers concurrently
 * will all observe the same cutoff and most deletes will be no-ops.
 *
 * Special case: when retentionDays is 0 we skip the delete (forever
 * retention) and return `skipped: true`.
 */
export async function pruneAuditEntries(
  db: Db,
  options: PruneOptions = {},
): Promise<PruneResult> {
  const retentionDays = options.retentionDays ?? resolveRetentionDays()
  const now = options.now ? options.now() : new Date()

  if (retentionDays === 0) {
    return { deleted: 0, cutoff: now, skipped: true }
  }

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)

  const deleted = await db
    .delete(schema.auditLog)
    .where(lt(schema.auditLog.createdAt, cutoff))
    .returning({ id: schema.auditLog.id })

  if (deleted.length > 0) {
    logger.info("audit_retention_sweep", {
      deleted: deleted.length,
      cutoff: cutoff.toISOString(),
      retentionDays,
    })
  }

  return { deleted: deleted.length, cutoff, skipped: false }
}

export { redactAuditMetadata, DEFAULT_REDACTED_KEYS }
