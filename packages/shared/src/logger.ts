type LogLevel = "error" | "warn" | "info" | "debug"

interface LogEntry {
  readonly timestamp: string
  readonly level: LogLevel
  readonly message: string
  readonly [key: string]: unknown
}

const REDACTED = "[REDACTED]"

const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /^authorization$/i,
  /^auth$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^x-api-key$/i,
  /token$/i,
  /^token/i,
  /apikey$/i,
  /api[-_]?key$/i,
  /secret$/i,
  /^secret/i,
  /password$/i,
  /passphrase$/i,
  /key$/i,
  /^key$/,
]

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

function redact(value: unknown, depth: number): unknown {
  if (depth > 6) return value
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1))
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? REDACTED : REDACTED
      } else {
        out[k] = redact(v, depth + 1)
      }
    }
    return out
  }
  return value
}

function createEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  const safeContext = context ? (redact(context, 0) as Record<string, unknown>) : undefined
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...safeContext,
  }
}

function write(entry: LogEntry): void {
  const line = JSON.stringify(entry) + "\n"
  if (entry.level === "error" || entry.level === "warn") {
    process.stderr.write(line)
  } else {
    process.stdout.write(line)
  }
}

export const logger = {
  error(message: string, context?: Record<string, unknown>): void {
    write(createEntry("error", message, context))
  },
  warn(message: string, context?: Record<string, unknown>): void {
    write(createEntry("warn", message, context))
  },
  info(message: string, context?: Record<string, unknown>): void {
    write(createEntry("info", message, context))
  },
  debug(message: string, context?: Record<string, unknown>): void {
    write(createEntry("debug", message, context))
  },
} as const
