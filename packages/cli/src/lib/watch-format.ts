import chalk from "chalk"

export interface ASTViolation {
  readonly file: string
  readonly line: number
  readonly rule: string
  readonly severity: string
  readonly message: string
}

export interface RuleViolation {
  readonly file: string
  readonly rule: string
  readonly severity: string
  readonly message: string
  readonly status: string
}

function severityTag(severity: string): string {
  if (severity === "error") return chalk.red("[ERROR]")
  if (severity === "warning") return chalk.yellow("[WARN] ")
  return chalk.blue("[INFO] ")
}

export function formatPrettyAST(violation: ASTViolation): string {
  const location = `${violation.file}:${violation.line}`
  return `${severityTag(violation.severity)} ${location} — ${violation.rule}: ${violation.message}`
}

export function formatPrettyRule(violation: RuleViolation): string {
  return `${severityTag(violation.severity)} ${violation.file} — ${violation.rule}: ${violation.message}`
}

export function formatJsonAST(violation: ASTViolation): string {
  return JSON.stringify(violation)
}

export function formatJsonRule(violation: RuleViolation): string {
  return JSON.stringify({
    file: violation.file,
    rule: violation.rule,
    severity: violation.severity,
    message: violation.message,
  })
}

export function shouldIgnore(filePath: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => filePath.includes(pattern))
}

export function createDebouncer(
  delayMs: number,
): (key: string, fn: () => void) => void {
  const timers = new Map<string, NodeJS.Timeout>()

  return (key: string, fn: () => void): void => {
    const existing = timers.get(key)
    if (existing) {
      clearTimeout(existing)
    }

    const timer = setTimeout(() => {
      timers.delete(key)
      fn()
    }, delayMs)

    timers.set(key, timer)
  }
}

export function writeOutput(text: string): void {
  process.stdout.write(text + "\n")
}
