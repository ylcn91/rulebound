import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";

// ── Users ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  githubId: text("github_id").unique(),
  email: text("email").unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Organizations ──────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  ownerId: uuid("owner_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    role: text("role").notNull().default("member"), // owner, admin, member
  },
  (table) => [primaryKey({ columns: [table.orgId, table.userId] })]
);

// ── Projects ───────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  repoUrl: text("repo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
});

// ── Rules ──────────────────────────────────────────────

export const rules = pgTable("rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  ruleSetId: uuid("rule_set_id")
    .references(() => ruleSets.id)
    .notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(), // architecture, security, style, testing, performance
  tags: text("tags").array(),
  severity: text("severity").notNull().default("warning"), // error, warning, info
  isActive: boolean("is_active").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
});

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
);

// ── API Tokens ─────────────────────────────────────────

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").unique().notNull(),
  scopes: text("scopes").array(),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
