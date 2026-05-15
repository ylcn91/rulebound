import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { runMigrations } from "../src/db/migrate.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let container: StartedPostgreSqlContainer | null = null

/**
 * Vitest globalSetup: boot Postgres 17 in a testcontainer, set DATABASE_URL,
 * apply drizzle migrations, and tear it down on test-run completion.
 *
 * Requires Docker. If the daemon is not running, this fails fast with the
 * underlying testcontainers error — that is the correct UX, since the
 * integration suite has no fallback.
 *
 * The container image is pinned to `postgres:17-alpine` to match the
 * production baseline declared in `packages/server/docs/server-readiness.md`.
 */
export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer("postgres:17-alpine")
    .withDatabase("rulebound_test")
    .withUsername("rulebound")
    .withPassword("rulebound_test_pwd")
    .start()

  const connectionString = container.getConnectionUri()
  process.env.DATABASE_URL = connectionString

  const migrationsFolder = path.resolve(__dirname, "..", "migrations")
  await runMigrations({ connectionString, migrationsFolder })
}

export async function teardown(): Promise<void> {
  if (container) {
    await container.stop()
    container = null
  }
}
