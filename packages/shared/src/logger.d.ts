export type LogLevel = "error" | "warn" | "info" | "debug"

export interface LogEntry {
  readonly timestamp: string
  readonly level: LogLevel
  readonly message: string
  readonly [key: string]: unknown
}

export interface Logger {
  error(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  debug(message: string, context?: Record<string, unknown>): void
}

export declare const logger: Logger
