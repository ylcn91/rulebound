type LogLevel = "error" | "warn" | "info" | "debug"

interface LogEntry {
  readonly timestamp: string
  readonly level: LogLevel
  readonly message: string
  readonly [key: string]: unknown
}

function createEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
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
