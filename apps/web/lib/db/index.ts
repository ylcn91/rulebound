import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL || "postgres://yalcindoksanbir@localhost:5432/rulebound";

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
