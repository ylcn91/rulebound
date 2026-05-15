import { fileURLToPath } from "node:url"
import path from "node:path"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Migrations live one level above dist/ at runtime, and two levels above src/ in dev.
// Resolving relative to this file keeps the helper portable.
const MIGRATIONS_FOLDER = path.resolve(__dirname, "..", "..", "migrations")

export interface RunMigrationsOptions {
  connectionString?: string
  migrationsFolder?: string
}

export async function runMigrations(options: RunMigrationsOptions = {}): Promise<void> {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations")
  }

  const migrationsFolder = options.migrationsFolder ?? MIGRATIONS_FOLDER

  const client = postgres(connectionString, { max: 1 })
  try {
    const db = drizzle(client)
    await migrate(db, { migrationsFolder })
  } finally {
    await client.end({ timeout: 5 })
  }
}

// Allow `node dist/db/migrate.js` to apply migrations from a deployment shell.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("Migrations applied")
      process.exit(0)
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Migration failed:", err)
      process.exit(1)
    })
}
