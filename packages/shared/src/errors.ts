/**
 * Canonical Rulebound API error envelope.
 *
 * Server, gateway, MCP, and SDK error responses converge on this shape. The
 * envelope is consumed by:
 * - `@rulebound/sdk` — parses `code`, `message`, `details`, `retriable` from
 *   non-2xx HTTP response bodies (see `sdks/typescript/src/index.ts`
 *   `RuleboundError`).
 * - `@rulebound/mcp` — `MCPNotice` is the MCP-specific projection: the
 *   `remedy` field corresponds to a free-form retry hint and is structurally
 *   convergent with the optional `retriable` flag here. See
 *   `packages/mcp/src/deterministic-tools.ts`.
 * - `@rulebound/gateway` — 422 violation responses additionally carry a
 *   `violations` array under `error.violations` for backward compatibility
 *   with `error.type === "rulebound_violation"`. This is documented as an
 *   explicit envelope exception in `docs/threat-model/gateway.md`.
 *
 * Stability: additive fields only — never rename `error`, `code`, or
 * `message`; never narrow `code` to an enum at the wire level. Consumers
 * MAY treat unknown `code` values as opaque strings.
 */
export interface RuleboundError {
  /**
   * Top-level discriminator. Always the literal `"error"` for envelope
   * recognition; HTTP transports also signal via non-2xx status codes.
   */
  readonly error: string

  /**
   * Stable machine-readable identifier, snake-case. Examples:
   * `"unauthorized"`, `"forbidden"`, `"validation_failed"`, `"not_found"`,
   * `"rate_limited"`, `"rule_violation"` (gateway-specific), `"timeout"`.
   *
   * Consumers MUST treat `code` as the primary discriminator for retries
   * and user-facing error messaging; `message` is human-readable only.
   */
  readonly code: string

  /**
   * Human-readable explanation. Safe to display in CLI output and logs.
   * MUST NOT contain credentials or PII; the producer is responsible for
   * redaction.
   */
  readonly message: string

  /**
   * Optional structured payload — typically validation issues, field paths,
   * or a copy of the offending input. Shape is `code`-specific.
   */
  readonly details?: unknown

  /**
   * If true, the caller MAY retry the same request after a backoff. If
   * false or absent, the caller SHOULD NOT retry without changing inputs.
   * Set by the producer based on whether the underlying condition is
   * transient.
   */
  readonly retriable?: boolean
}

/**
 * Type guard for the envelope. Use when parsing an opaque response body
 * (e.g. SDK error path, dashboard proxy error pass-through).
 */
export function isRuleboundError(value: unknown): value is RuleboundError {
  if (value === null || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.error === "string" &&
    typeof v.code === "string" &&
    typeof v.message === "string"
  )
}
