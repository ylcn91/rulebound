import { z } from "zod"
import { logger } from "@rulebound/shared/logger"

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

export interface WarnLegacyScopesEnvOptions {
  readonly env?: NodeJS.ProcessEnv
}

/**
 * Emits a one-shot startup warn when RULEBOUND_LEGACY_TOKEN_SCOPES=1 is set.
 *
 * This mirrors the per-request deprecation log emitted by requireScope() so
 * that operators see the deprecation signal at boot even if no request ever
 * hits a guarded route. The legacy bypass keeps tokens that carry an empty
 * scope array authenticating against every route during the v0.2 window;
 * v0.3 turns the env into a no-op (always treated as 0) and v0.4 drops the
 * legacy string mapping entirely. See
 * `packages/server/docs/scope-taxonomy.md` for the timeline.
 */
export function warnLegacyTokenScopesEnv(
  options: WarnLegacyScopesEnvOptions = {},
): boolean {
  const source = options.env ?? process.env
  if (source.RULEBOUND_LEGACY_TOKEN_SCOPES !== "1") {
    return false
  }
  logger.warn(
    "deprecation: RULEBOUND_LEGACY_TOKEN_SCOPES=1 is enabled. Tokens with an " +
      "empty scope array bypass scope enforcement during the v0.2 window. " +
      "This env becomes a no-op in v0.3.0. Rotate tokens to carry explicit " +
      "scopes before upgrading.",
  )
  return true
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
