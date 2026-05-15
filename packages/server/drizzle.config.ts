import { defineConfig } from "drizzle-kit"

// Source of truth: src/db/schema.ts.
// Generated migrations live under ./migrations and are committed.
// `db:check` (drizzle-kit check) verifies the schema and the migrations are in sync.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  strict: true,
  verbose: false,
})
