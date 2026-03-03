import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  primaryKey,
  jsonb,
  index,
} from "drizzle-orm/pg-core"

// ── Users ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  githubId: text("github_id").unique(),
  email: text("email").unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Organizations ──────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  ownerId: uuid("owner_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    role: text("role").notNull().default("member"),
  },
  (table) => [primaryKey({ columns: [table.orgId, table.userId] })]
)

// ── Projects ───────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  repoUrl: text("repo_url"),
  stack: text("stack").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Rule Sets ──────────────────────────────────────────

export const ruleSets = pgTable("rule_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isGlobal: boolean("is_global").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Rules ──────────────────────────────────────────────

export const rules = pgTable("rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  ruleSetId: uuid("rule_set_id")
    .references(() => ruleSets.id)
    .notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull().default("warning"),
  modality: text("modality").notNull().default("should"),
  tags: text("tags").array(),
  stack: text("stack").array(),
  isActive: boolean("is_active").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Rule Versions ──────────────────────────────────────

export const ruleVersions = pgTable("rule_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ruleId: uuid("rule_id")
    .references(() => rules.id)
    .notNull(),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  changedBy: uuid("changed_by").references(() => users.id),
  changeNote: text("change_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Project <> RuleSet mapping ─────────────────────────

export const projectRuleSets = pgTable(
  "project_rule_sets",
  {
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    ruleSetId: uuid("rule_set_id")
      .references(() => ruleSets.id)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.ruleSetId] })]
)

// ── API Tokens ─────────────────────────────────────────

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").unique().notNull(),
  tokenPrefix: text("token_prefix").notNull(),
  scopes: text("scopes").array(),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Audit Log ──────────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    projectId: uuid("project_id").references(() => projects.id),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    ruleId: uuid("rule_id").references(() => rules.id),
    status: text("status").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_org_id_idx").on(table.orgId),
    index("audit_log_project_id_idx").on(table.projectId),
    index("audit_log_created_at_idx").on(table.createdAt),
  ]
)

// ── Webhook Endpoints (outbound) ───────────────────────

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// ── Webhook Deliveries ─────────────────────────────────

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    endpointId: uuid("endpoint_id")
      .references(() => webhookEndpoints.id)
      .notNull(),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    responseCode: integer("response_code"),
    responseBody: text("response_body"),
    attempts: integer("attempts").default(0).notNull(),
    nextRetryAt: timestamp("next_retry_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("webhook_deliveries_endpoint_idx").on(table.endpointId),
    index("webhook_deliveries_status_idx").on(table.status),
  ]
)

// ── Webhook Sources (inbound) ──────────────────────────

export const webhookSources = pgTable("webhook_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  provider: text("provider").notNull(),
  repoUrl: text("repo_url"),
  secret: text("secret").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

// ── Rule Sync State ────────────────────────────────────

export const ruleSyncState = pgTable("rule_sync_state", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  ruleVersionHash: text("rule_version_hash").notNull(),
  status: text("status").notNull().default("synced"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
})

// ── Compliance Snapshots ───────────────────────────────

export const complianceSnapshots = pgTable(
  "compliance_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id)
      .notNull(),
    score: integer("score").notNull(),
    passCount: integer("pass_count").notNull(),
    violatedCount: integer("violated_count").notNull(),
    notCoveredCount: integer("not_covered_count").notNull(),
    snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
  },
  (table) => [
    index("compliance_snapshots_project_idx").on(table.projectId),
    index("compliance_snapshots_date_idx").on(table.snapshotAt),
  ]
)
