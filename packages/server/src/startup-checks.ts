import { z } from "zod"

const HEX_64 = /^[0-9a-fA-F]{64}$/

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL must be set to a Postgres connection string"),
  RULEBOUND_ENCRYPTION_KEY: z
    .string()
    .regex(
      HEX_64,
      "RULEBOUND_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
    ),
})

export type ServerEnv = z.infer<typeof envSchema>

export interface ValidateServerEnvOptions {
  readonly env?: NodeJS.ProcessEnv
}

/**
 * Validates required environment variables for the server at boot.
 * Throws an Error with a clear, aggregated message when anything is missing
 * or malformed. Does not attempt to repair, default, or fall back.
 *
 * Only validates variables the server itself reads directly. Per-feature
 * tokens (webhook secrets, notification provider tokens, etc.) are stored
 * encrypted in the database and checked at request time, not at boot.
 */
export function validateServerEnv(
  options: ValidateServerEnvOptions = {},
): ServerEnv {
  const source = options.env ?? process.env
  const result = envSchema.safeParse({
    DATABASE_URL: source.DATABASE_URL,
    RULEBOUND_ENCRYPTION_KEY: source.RULEBOUND_ENCRYPTION_KEY,
  })

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n")
    throw new Error(
      `Rulebound server cannot start: invalid environment.\n${issues}`,
    )
  }

  return result.data
}
