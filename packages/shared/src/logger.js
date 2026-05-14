const REDACTED = "[REDACTED]"

const SENSITIVE_KEY_PATTERNS = [
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

function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

function redact(value, depth) {
  if (depth > 6) return value
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1))
  }
  if (typeof value === "object") {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (isSensitiveKey(k)) {
        out[k] = REDACTED
      } else {
        out[k] = redact(v, depth + 1)
      }
    }
    return out
  }
  return value
}

function createEntry(level, message, context) {
  const safeContext = context ? redact(context, 0) : undefined
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...safeContext,
  }
}

function write(entry) {
  const line = JSON.stringify(entry) + "\n"
  if (entry.level === "error" || entry.level === "warn") {
    process.stderr.write(line)
  } else {
    process.stdout.write(line)
  }
}

export const logger = {
  error(message, context) {
    write(createEntry("error", message, context))
  },
  warn(message, context) {
    write(createEntry("warn", message, context))
  },
  info(message, context) {
    write(createEntry("info", message, context))
  },
  debug(message, context) {
    write(createEntry("debug", message, context))
  },
}
