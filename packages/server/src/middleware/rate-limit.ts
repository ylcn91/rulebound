import type { Context, MiddlewareHandler, Next } from "hono"
import { logger } from "@rulebound/shared/logger"
import { getRequestIdentity } from "../lib/request-context.js"

export interface RateLimitConfig {
  perMinuteToken?: number
  perMinuteIp?: number
  /**
   * Path prefixes that are exempt from rate limiting. The default is
   * `/health`. Public health checks must not consume rate-limit budget; if
   * they did, a misconfigured liveness probe could trip the limiter and lock
   * out real traffic.
   */
  exemptPathPrefixes?: readonly string[]
  /**
   * Maximum number of bucket entries kept in memory. When the store hits this
   * cap, the oldest-touched bucket is evicted. Protects against unbounded
   * growth on hostile clients that rotate IPs.
   */
  maxEntries?: number
  /**
   * Injectable clock for deterministic tests. Returns milliseconds since the
   * epoch.
   */
  now?: () => number
  /**
   * Injectable env reader (defaults to `process.env`). Lets the test suite
   * mutate limits without touching the real process env.
   */
  env?: NodeJS.ProcessEnv
}

const DEFAULT_EXEMPT_PATH_PREFIXES = ["/health"] as const
const DEFAULT_MAX_ENTRIES = 10_000
const WINDOW_MS = 60_000

interface Bucket {
  /** Tokens remaining in the bucket. */
  tokens: number
  /** Bucket capacity in tokens (== per-minute limit). */
  capacity: number
  /** Refill rate in tokens/ms (capacity / WINDOW_MS). */
  refillPerMs: number
  /** Last time we computed a refill, in ms-since-epoch. */
  lastRefillMs: number
}

interface ResolvedLimits {
  token: number | null
  ip: number | null
}

function readLimit(env: NodeJS.ProcessEnv, key: string): number | null {
  const raw = env[key]
  if (raw === undefined || raw === null || raw.trim() === "") return null
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function resolveLimits(
  config: RateLimitConfig,
  env: NodeJS.ProcessEnv,
): ResolvedLimits {
  const tokenLimit =
    config.perMinuteToken ??
    readLimit(env, "RULEBOUND_RATE_LIMIT_PER_MIN_TOKEN")
  const ipLimit =
    config.perMinuteIp ?? readLimit(env, "RULEBOUND_RATE_LIMIT_PER_MIN_IP")
  return { token: tokenLimit ?? null, ip: ipLimit ?? null }
}

function isExempt(path: string, prefixes: readonly string[]): boolean {
  for (const prefix of prefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true
  }
  return false
}

function extractClientIp(c: Context): string {
  // Order: X-Forwarded-For (first hop), X-Real-IP, remote address.
  const xff = c.req.header("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = c.req.header("x-real-ip")
  if (realIp) return realIp.trim()
  // hono/node provides remoteAddr on the runtime info; fall back to "unknown"
  // so we still rate-limit hostile callers that hide behind no proxy headers.
  // Treating "unknown" as a shared bucket is conservative — it groups
  // anonymous traffic under a single limit instead of giving each request its
  // own bucket.
  return "unknown"
}

interface BucketStoreOptions {
  maxEntries: number
  now: () => number
}

class BucketStore {
  private readonly buckets = new Map<string, Bucket>()
  private readonly maxEntries: number
  private readonly now: () => number

  constructor(options: BucketStoreOptions) {
    this.maxEntries = options.maxEntries
    this.now = options.now
  }

  /**
   * Consume one token from the bucket for `key` against `capacity`. Returns
   * the seconds the caller must wait before retrying, or 0 if allowed.
   */
  consume(key: string, capacity: number): number {
    const refillPerMs = capacity / WINDOW_MS
    const nowMs = this.now()
    let bucket = this.buckets.get(key)

    if (!bucket) {
      this.ensureCapacity()
      bucket = {
        tokens: capacity - 1,
        capacity,
        refillPerMs,
        lastRefillMs: nowMs,
      }
      this.buckets.set(key, bucket)
      return 0
    }

    // Re-use existing bucket; refresh capacity if the configured limit
    // changed at runtime (env mutated between tests).
    if (bucket.capacity !== capacity) {
      bucket.capacity = capacity
      bucket.refillPerMs = refillPerMs
      if (bucket.tokens > capacity) bucket.tokens = capacity
    }

    const elapsed = nowMs - bucket.lastRefillMs
    if (elapsed > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs)
      bucket.lastRefillMs = nowMs
    }

    // Touch by reinserting so the LRU eviction picks the truly-oldest bucket.
    this.buckets.delete(key)
    this.buckets.set(key, bucket)

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return 0
    }

    const missing = 1 - bucket.tokens
    const waitMs = missing / refillPerMs
    return Math.max(1, Math.ceil(waitMs / 1000))
  }

  size(): number {
    return this.buckets.size
  }

  private ensureCapacity(): void {
    if (this.buckets.size < this.maxEntries) return
    // Map preserves insertion order; the first key is the oldest-touched.
    const oldest = this.buckets.keys().next().value
    if (oldest !== undefined) this.buckets.delete(oldest)
  }
}

/**
 * rateLimit returns a Hono middleware that enforces per-token and per-IP
 * limits. The limiter is **default-off**: when neither
 * `RULEBOUND_RATE_LIMIT_PER_MIN_TOKEN` nor `RULEBOUND_RATE_LIMIT_PER_MIN_IP`
 * is set, the middleware is a no-op. This matches lead verdict B2 — operators
 * opt in explicitly via env (production runbook still mandates a reverse
 * proxy as the primary DDoS defence).
 *
 * Identity context comes from the auth middleware (`identity.orgId`), so this
 * middleware must be wired after `authMiddleware`. Health-prefixed paths are
 * exempted regardless of auth wiring.
 */
export function rateLimit(config: RateLimitConfig = {}): MiddlewareHandler {
  const exemptPrefixes = config.exemptPathPrefixes ?? DEFAULT_EXEMPT_PATH_PREFIXES
  const maxEntries = config.maxEntries ?? DEFAULT_MAX_ENTRIES
  const now = config.now ?? (() => Date.now())
  const store = new BucketStore({ maxEntries, now })

  return async (c: Context, next: Next) => {
    const env = config.env ?? process.env
    const limits = resolveLimits(config, env)

    if (limits.token === null && limits.ip === null) {
      // Default-off behaviour per lead verdict B2.
      await next()
      return
    }

    if (isExempt(c.req.path, exemptPrefixes)) {
      await next()
      return
    }

    const identity = getRequestIdentity(c)
    const ip = extractClientIp(c)

    let retryAfter = 0

    if (limits.token !== null && identity) {
      const wait = store.consume(`token:${identity.orgId}`, limits.token)
      if (wait > retryAfter) retryAfter = wait
    }

    if (limits.ip !== null) {
      const wait = store.consume(`ip:${ip}`, limits.ip)
      if (wait > retryAfter) retryAfter = wait
    }

    if (retryAfter > 0) {
      logger.warn("rate_limit_exceeded", {
        orgId: identity?.orgId,
        ip,
        retryAfter,
        path: c.req.path,
      })
      c.header("Retry-After", String(retryAfter))
      return c.json(
        {
          error: "Rate limit exceeded",
          retryAfter,
        },
        429,
      )
    }

    await next()
  }
}

// Test-only export — keep the public surface minimal but allow the spec to
// assert internal behaviour (LRU eviction, etc.) without resorting to timing
// games.
export const __testing = {
  WINDOW_MS,
  DEFAULT_MAX_ENTRIES,
}
