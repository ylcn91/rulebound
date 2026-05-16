import chalk from "chalk"
import { loadWaiversWithErrors, type Waiver } from "@rulebound/engine"

interface WaiversListOptions {
  readonly format?: string
  readonly waivers?: string
  readonly expiringWithin?: string
  readonly strict?: boolean
}

interface WaiverRow {
  readonly rule: string
  readonly check?: string
  readonly owner: string
  readonly reason: string
  readonly expires: string
  readonly expired: boolean
  readonly daysUntilExpiry: number
  readonly expiring: boolean
  readonly scope: readonly string[]
}

function parseDays(value: string | undefined): number {
  if (value === undefined) return 14
  if (!/^\d+$/.test(value)) {
    console.error(chalk.red(`Invalid --expiring-within value: ${value}`))
    process.exit(2)
  }
  return Number(value)
}

function daysUntil(expires: string, now: Date): number {
  const ms = new Date(expires).getTime() - now.getTime()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

function toRow(waiver: Waiver, now: Date, expiringWithinDays: number): WaiverRow {
  const daysUntilExpiry = daysUntil(waiver.expires, now)
  const expired = daysUntilExpiry < 0
  return {
    rule: waiver.rule,
    ...(waiver.check !== undefined ? { check: waiver.check } : {}),
    owner: waiver.owner,
    reason: waiver.reason,
    expires: waiver.expires,
    expired,
    daysUntilExpiry,
    expiring: !expired && daysUntilExpiry <= expiringWithinDays,
    scope: waiver.scope ?? [],
  }
}

function printTable(rows: readonly WaiverRow[], path: string): void {
  console.log(chalk.bold(`Waivers (${rows.length}) from ${path}`))
  if (rows.length === 0) {
    console.log(chalk.dim("No waivers configured."))
    return
  }

  console.log(chalk.dim(`${"STATUS".padEnd(10)}${"RULE".padEnd(32)}${"OWNER".padEnd(18)}${"EXPIRES".padEnd(14)}REASON`))
  console.log(chalk.dim("─".repeat(100)))
  for (const row of rows) {
    const status = row.expired ? chalk.red("expired") : row.expiring ? chalk.yellow("expiring") : chalk.green("active")
    const rule = row.rule.length > 30 ? `${row.rule.slice(0, 27)}...` : row.rule
    const owner = row.owner.length > 16 ? `${row.owner.slice(0, 13)}...` : row.owner
    console.log(`${status.padEnd(19)}${rule.padEnd(32)}${owner.padEnd(18)}${row.expires.padEnd(14)}${row.reason}`)
  }
}

export async function waiversListCommand(options: WaiversListOptions = {}): Promise<void> {
  const format = options.format ?? "table"
  if (format !== "table" && format !== "json") {
    console.error(chalk.red(`Unsupported waivers format: ${format}`))
    console.error(chalk.dim("Use --format table or --format json."))
    process.exit(2)
  }

  const expiringWithinDays = parseDays(options.expiringWithin)
  const loaded = loadWaiversWithErrors(process.cwd(), options.waivers)
  if (loaded.errors.length > 0) {
    if (format === "json") {
      console.log(JSON.stringify({ status: "error", path: loaded.path, errors: loaded.errors }, null, 2))
    } else {
      console.error(chalk.red.bold(`waiver load errors (${loaded.errors.length}):`))
      for (const error of loaded.errors) {
        console.error(chalk.red(`  ${error.path} ${error.message}`))
      }
    }
    process.exit(2)
  }

  const now = new Date()
  const rows = loaded.waivers.map((waiver) => toRow(waiver, now, expiringWithinDays))
  const expired = rows.filter((row) => row.expired).length
  const expiring = rows.filter((row) => row.expiring).length
  const status = expired > 0 ? "fail" : expiring > 0 ? "warn" : "ok"

  if (format === "json") {
    console.log(JSON.stringify({
      status,
      path: loaded.path,
      total: rows.length,
      expired,
      expiring,
      expiringWithinDays,
      waivers: rows,
    }, null, 2))
  } else {
    printTable(rows, loaded.path)
    if (expired > 0) console.log(chalk.red(`${expired} waiver(s) expired.`))
    if (expiring > 0) console.log(chalk.yellow(`${expiring} waiver(s) expire within ${expiringWithinDays} day(s).`))
  }

  if (options.strict && (expired > 0 || expiring > 0)) {
    process.exit(expired > 0 ? 1 : 3)
  }
}
