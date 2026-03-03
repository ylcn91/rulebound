import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import * as schema from "./schema.js"

let dbInstance: ReturnType<typeof drizzle> | null = null

export function getDb(connectionString?: string) {
  if (dbInstance) return dbInstance

  const connStr = connectionString ?? process.env.DATABASE_URL
  if (!connStr) {
    throw new Error("DATABASE_URL environment variable is required")
  }

  const client = postgres(connStr)
  dbInstance = drizzle(client, { schema })
  return dbInstance
}

export { schema }
