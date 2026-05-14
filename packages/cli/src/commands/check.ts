import { resolve } from "node:path"
import { execFileSync } from "node:child_process"
import chalk from "chalk"
import {
  findRulesDir,
  loadRulesWithInheritance,
  validateDeterministic,
  loadWaiversWithErrors,
  type DeterministicReport,
  type CheckResult,
  type Rule,
  type WaiverLoadError,
} from "@rulebound/engine"
import { extractChangedFiles, readGitDiff } from "../lib/git-diff.js"

export interface CheckOptions {
  readonly dir?: string
  readonly format?: "pretty" | "json" | "github" | "repair-json" | "sarif" | "pr-markdown"
  readonly diff?: boolean
  readonly staged?: boolean
  readonly base?: string
  readonly ref?: string
  readonly allowCommands?: boolean
  readonly failOnAdvisory?: boolean
  readonly rule?: string
  readonly waivers?: string
}

interface RunContext {
  readonly cwd: string
  readonly rules: readonly Rule[]
  readonly changedFiles: readonly string[]
  readonly branch?: string
}

function detectBranch(cwd: string): string | undefined {
  try {
    return execFileSync("git", ["-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return undefined
  }
}

function detectChangedFiles(opts: CheckOptions, cwd: string): string[] {
  try {
    if (opts.base) {
      try {
        const out = execFileSync("git", ["-C", cwd, "diff", "--name-only", `${opts.base}...HEAD`], {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        })
        return out.split("\n").filter(Boolean)
      } catch {
        const remoteBase = opts.base.startsWith("origin/") ? opts.base : `origin/${opts.base}`
        const out = execFileSync("git", ["-C", cwd, "diff", "--name-only", `${remoteBase}...HEAD`], {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        })
        return out.split("\n").filter(Boolean)
      }
    }
    if (opts.staged) {
      const out = execFileSync("git", ["-C", cwd, "diff", "--cached", "--name-only"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })
      return out.split("\n").filter(Boolean)
    }
    if (opts.diff || opts.ref) {
      const diff = readGitDiff({ ...(opts.ref ? { ref: opts.ref } : {}) })
      return extractChangedFiles(diff.diffText)
    }
    return []
  } catch {
    return []
  }
}

function loadContext(opts: CheckOptions): RunContext {
  const cwd = process.cwd()
  const rulesDir = opts.dir ? resolve(cwd, opts.dir) : findRulesDir(cwd)
  if (!rulesDir) {
    return { cwd, rules: [], changedFiles: [] }
  }
  let rules = loadRulesWithInheritance(cwd, opts.dir ? rulesDir : undefined)
  if (opts.rule) {
    rules = rules.filter((r) => r.id === opts.rule || r.id.startsWith(`${opts.rule}.`))
  }
  const branch = detectBranch(cwd)
  return {
    cwd,
    rules,
    changedFiles: detectChangedFiles(opts, cwd),
    ...(branch !== undefined ? { branch } : {}),
  }
}

function statusColor(status: string): (s: string) => string {
  switch (status) {
    case "PASS":
      return chalk.green
    case "VIOLATED":
      return chalk.red
    case "ERROR":
      return chalk.magenta
    case "NOT_APPLICABLE":
      return chalk.gray
    default:
      return chalk.white
  }
}

function printPretty(report: DeterministicReport): void {
  const { summary, status, results, parseErrors, waiversApplied } = report
  const headerColor = status === "FAILED" ? chalk.red : status === "PASSED" ? chalk.green : chalk.yellow
  console.log()
  console.log(headerColor.bold(`rulebound check — ${status}`))
  console.log(
    chalk.gray(
      `  ${summary.pass} pass · ${summary.violated} violated · ${summary.notApplicable} n/a · ${summary.error} error · ${summary.blocking} blocking · ${summary.waived} waived`,
    ),
  )

  if (parseErrors.length > 0) {
    console.log()
    console.log(chalk.yellow("rule schema errors:"))
    for (const e of parseErrors) {
      console.log(chalk.yellow(`  ${e.ruleId}`))
      for (const msg of e.errors) console.log(chalk.gray(`    - ${msg}`))
    }
  }

  const interesting = results.filter((r) => r.status !== "PASS" && r.status !== "NOT_APPLICABLE")
  const blocking = interesting.filter((r) => !r.waived)
  const waived = interesting.filter((r) => Boolean(r.waived))

  if (interesting.length === 0) {
    console.log()
    console.log(chalk.gray("  (no violations)"))
  } else {
    console.log()
    for (const r of blocking) {
      const color = statusColor(r.status)
      const blockTag = r.blocking ? chalk.red.bold("[block]") : chalk.gray("[warn]")
      console.log(`${color(r.status)} ${blockTag} ${chalk.bold(r.ruleId)} ${chalk.gray(`(${r.source})`)}`)
      if (r.evidence?.filePath) {
        const loc = r.evidence.line ? `:${r.evidence.line}` : ""
        console.log(chalk.gray(`  ↳ ${r.evidence.filePath}${loc}`))
      }
      if (r.evidence?.snippet) {
        console.log(chalk.gray(`    ${r.evidence.snippet.slice(0, 200)}`))
      }
      console.log(`  ${r.reason}`)
      if (r.suggestedFix) console.log(chalk.cyan(`  fix: ${r.suggestedFix}`))
      console.log()
    }

    if (waived.length > 0) {
      console.log(chalk.yellow.bold("waived (advisory):"))
      for (const r of waived) {
        const expiresTag = r.waived?.expires ? chalk.gray(` until ${r.waived.expires}`) : ""
        const loc = r.evidence?.filePath ? chalk.gray(` ↳ ${r.evidence.filePath}${r.evidence.line ? `:${r.evidence.line}` : ""}`) : ""
        console.log(`  ${chalk.yellow("[waived]")} ${chalk.bold(r.ruleId)}${expiresTag}${loc}`)
        console.log(chalk.gray(`    reason: ${r.waived?.reason ?? ""}`))
      }
      console.log()
    }
  }

  const expiredWaivers = waiversApplied.filter((w) => w.expired)
  if (expiredWaivers.length > 0) {
    console.log(chalk.red.bold("expired waivers (re-blocking):"))
    for (const w of expiredWaivers) {
      console.log(`  ${chalk.red("[expired]")} ${w.waiver.rule} (expired ${w.waiver.expires})`)
    }
    console.log()
  }
}

function printJson(report: DeterministicReport): void {
  console.log(JSON.stringify(report, null, 2))
}

function printGithub(report: DeterministicReport): void {
  for (const r of report.results) {
    if (r.status !== "VIOLATED" && r.status !== "ERROR") continue
    const level = r.waived ? "notice" : r.blocking ? "error" : "warning"
    const file = r.evidence?.filePath ? `file=${escape(r.evidence.filePath)}` : ""
    const line = r.evidence?.line ? `,line=${r.evidence.line}` : ""
    const col = r.evidence?.column ? `,col=${r.evidence.column}` : ""
    const titlePrefix = r.waived ? `[waived] ` : ""
    const title = `title=${escape(`${titlePrefix}[${r.ruleId}] ${r.checkId}`)}`
    const parts = [file, line, col].filter(Boolean).join("")
    const message = escape(r.reason)
    console.log(`::${level} ${parts}${parts ? "," : ""}${title}::${message}`)
  }
  for (const w of report.waiversApplied.filter((x) => x.expired)) {
    console.log(
      `::warning title=${escape(`expired waiver for ${w.waiver.rule}`)}::Waiver expired on ${w.waiver.expires}. Rule re-blocks.`,
    )
  }
  console.log(
    `::notice::rulebound ${report.status} (${report.summary.violated} violated, ${report.summary.blocking} blocking, ${report.summary.waived} waived)`,
  )
}

function escape(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")
}

interface RepairItem {
  readonly ruleId: string
  readonly checkId: string
  readonly source: string
  readonly file?: string
  readonly line?: number
  readonly evidence?: CheckResult["evidence"]
  readonly reason: string
  readonly suggestedFix?: string
  readonly rerun: string
}

interface SarifSuppression {
  readonly kind: "external"
  readonly status: "accepted"
  readonly justification: string
  readonly properties?: Readonly<Record<string, unknown>>
}

interface SarifResult {
  readonly ruleId: string
  readonly level: "error" | "warning" | "note"
  readonly message: { readonly text: string }
  readonly locations?: readonly {
    readonly physicalLocation: {
      readonly artifactLocation: { readonly uri: string }
      readonly region?: { readonly startLine?: number; readonly startColumn?: number; readonly snippet?: { readonly text: string } }
    }
  }[]
  readonly suppressions?: readonly SarifSuppression[]
  readonly properties?: Readonly<Record<string, unknown>>
}

interface SarifRule {
  readonly id: string
  readonly name?: string
  readonly shortDescription?: { readonly text: string }
  readonly defaultConfiguration?: { readonly level: "error" | "warning" | "note" }
  readonly properties?: Readonly<Record<string, unknown>>
}

function sarifLevel(r: CheckResult): "error" | "warning" | "note" {
  if (r.waived) return "note"
  if (r.status === "VIOLATED" || r.status === "ERROR") return r.blocking ? "error" : "warning"
  return "note"
}

function printSarif(report: DeterministicReport): void {
  const ruleMap = new Map<string, SarifRule>()
  const results: SarifResult[] = []

  for (const r of report.results) {
    if (r.status !== "VIOLATED" && r.status !== "ERROR") continue
    if (!ruleMap.has(r.ruleId)) {
      ruleMap.set(r.ruleId, {
        id: r.ruleId,
        name: r.ruleId,
        shortDescription: { text: r.ruleId },
        defaultConfiguration: { level: r.blocking ? "error" : "warning" },
        properties: { source: r.source, deterministic: r.deterministic, confidence: r.confidence },
      })
    }
    const region = r.evidence?.line
      ? {
          startLine: r.evidence.line,
          ...(r.evidence.column !== undefined ? { startColumn: r.evidence.column } : {}),
          ...(r.evidence.snippet ? { snippet: { text: r.evidence.snippet.slice(0, 500) } } : {}),
        }
      : undefined
    const locations = r.evidence?.filePath
      ? [
          {
            physicalLocation: {
              artifactLocation: { uri: r.evidence.filePath },
              ...(region ? { region } : {}),
            },
          },
        ]
      : undefined
    const suppressions: SarifSuppression[] | undefined = r.waived
      ? [
          {
            kind: "external",
            status: "accepted",
            justification: r.waived.reason,
            ...(r.waived.expires ? { properties: { expires: r.waived.expires } } : {}),
          },
        ]
      : undefined
    results.push({
      ruleId: r.ruleId,
      level: sarifLevel(r),
      message: { text: r.reason },
      ...(locations ? { locations } : {}),
      ...(suppressions ? { suppressions } : {}),
      properties: {
        checkId: r.checkId,
        source: r.source,
        deterministic: r.deterministic,
        confidence: r.confidence,
        blocking: r.blocking,
        waived: Boolean(r.waived),
        ...(r.suggestedFix ? { suggestedFix: r.suggestedFix } : {}),
      },
    })
  }

  const sarif = {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "rulebound",
            informationUri: "https://github.com/rulebound/rulebound",
            rules: Array.from(ruleMap.values()),
          },
        },
        results,
      },
    ],
  }
  console.log(JSON.stringify(sarif, null, 2))
}

interface WaivedItem {
  readonly ruleId: string
  readonly checkId: string
  readonly file?: string
  readonly line?: number
  readonly waiverReason: string
  readonly expires?: string
}

function statusBadge(status: DeterministicReport["status"]): string {
  switch (status) {
    case "PASSED":
      return "**PASSED**"
    case "FAILED":
      return "**FAILED**"
    case "PASSED_WITH_WARNINGS":
      return "**PASSED_WITH_WARNINGS**"
  }
}

function evidenceLine(r: CheckResult): string {
  if (!r.evidence?.filePath) return ""
  const line = r.evidence.line ? `:${r.evidence.line}` : ""
  return `\`${r.evidence.filePath}${line}\``
}

function bullet(label: string, value: string | number): string {
  return `- **${label}:** ${value}`
}

export function renderPrMarkdown(report: DeterministicReport, rerunHint: string): string {
  const { status, summary, results, parseErrors, waiversApplied, ruleStatuses } = report
  const blockers = results.filter((r) => (r.status === "VIOLATED" || r.status === "ERROR") && r.blocking && !r.waived)
  const warnings = results.filter((r) => (r.status === "VIOLATED" || r.status === "ERROR") && !r.blocking && !r.waived)
  const waived = results.filter((r) => Boolean(r.waived))
  const advisoryRules = ruleStatuses.filter((r) => r.status === "ADVISORY").length
  const analyzerFindings = results.filter((r) => r.source === "analyzer")
  const analyzerBlocking = analyzerFindings.filter((r) => r.blocking && !r.waived).length

  const out: string[] = []
  out.push(`## rulebound check — ${statusBadge(status)}`)
  out.push("")
  out.push(
    [
      bullet("Pass", summary.pass),
      bullet("Violated", summary.violated),
      bullet("Blocking", summary.blocking),
      bullet("Waived", summary.waived),
      bullet("Not applicable", summary.notApplicable),
      bullet("Errors", summary.error),
      bullet("Advisory-only rules", advisoryRules),
    ].join("\n"),
  )
  out.push("")

  if (parseErrors.length > 0) {
    out.push("### Rule schema errors")
    out.push("")
    for (const e of parseErrors) {
      out.push(`- \`${e.ruleId}\``)
      for (const msg of e.errors) out.push(`  - ${msg}`)
    }
    out.push("")
  }

  out.push("### Deterministic blockers")
  out.push("")
  if (blockers.length === 0) {
    out.push("_None._")
  } else {
    out.push("| Rule | Check | Location | Reason |")
    out.push("| --- | --- | --- | --- |")
    for (const r of blockers) {
      const loc = evidenceLine(r) || "_repo-wide_"
      out.push(`| \`${r.ruleId}\` | \`${r.checkId}\` | ${loc} | ${escapeCell(r.reason)} |`)
    }
  }
  out.push("")

  out.push("### Deterministic warnings")
  out.push("")
  if (warnings.length === 0) {
    out.push("_None._")
  } else {
    out.push("| Rule | Check | Location | Reason |")
    out.push("| --- | --- | --- | --- |")
    for (const r of warnings) {
      const loc = evidenceLine(r) || "_repo-wide_"
      out.push(`| \`${r.ruleId}\` | \`${r.checkId}\` | ${loc} | ${escapeCell(r.reason)} |`)
    }
  }
  out.push("")

  out.push("### Waivers applied")
  out.push("")
  if (waived.length === 0 && waiversApplied.length === 0) {
    out.push("_None._")
  } else {
    out.push("| Rule | Path | Owner | Expires | Reason |")
    out.push("| --- | --- | --- | --- | --- |")
    for (const w of waiversApplied) {
      if (w.expired) continue
      const loc = w.result.evidence?.filePath ? `\`${w.result.evidence.filePath}\`` : "_repo-wide_"
      out.push(
        `| \`${w.waiver.rule}\` | ${loc} | ${escapeCell(w.waiver.owner)} | ${w.waiver.expires} | ${escapeCell(w.waiver.reason)} |`,
      )
    }
    const expired = waiversApplied.filter((w) => w.expired)
    if (expired.length > 0) {
      out.push("")
      out.push("**Expired waivers (re-blocking):**")
      for (const w of expired) {
        out.push(`- \`${w.waiver.rule}\` — expired ${w.waiver.expires} (owner: ${w.waiver.owner})`)
      }
    }
  }
  out.push("")

  out.push("### Analyzer findings")
  out.push("")
  if (analyzerFindings.length === 0) {
    out.push("_No analyzer checks ran._")
  } else {
    out.push(`- Total: ${analyzerFindings.length}`)
    out.push(`- Blocking: ${analyzerBlocking}`)
  }
  out.push("")

  out.push("### Repair")
  out.push("")
  if (status === "PASSED") {
    out.push("All deterministic checks passed.")
  } else {
    out.push("Re-run after fixes:")
    out.push("")
    out.push("```bash")
    out.push(rerunHint)
    out.push("```")
  }
  out.push("")
  out.push("---")
  out.push(`_Generated by \`rulebound check --format pr-markdown\`._`)

  return out.join("\n")
}

function printPrMarkdown(report: DeterministicReport, rerunHint: string): void {
  console.log(renderPrMarkdown(report, rerunHint))
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").slice(0, 300)
}

function printRepairJson(report: DeterministicReport, allowCommands: boolean): void {
  const items: RepairItem[] = []
  const waived: WaivedItem[] = []
  for (const r of report.results) {
    if (r.status !== "VIOLATED" && r.status !== "ERROR") continue
    if (r.waived) {
      waived.push({
        ruleId: r.ruleId,
        checkId: r.checkId,
        ...(r.evidence?.filePath ? { file: r.evidence.filePath } : {}),
        ...(r.evidence?.line ? { line: r.evidence.line } : {}),
        waiverReason: r.waived.reason,
        ...(r.waived.expires ? { expires: r.waived.expires } : {}),
      })
      continue
    }
    items.push({
      ruleId: r.ruleId,
      checkId: r.checkId,
      source: r.source,
      ...(r.evidence?.filePath ? { file: r.evidence.filePath } : {}),
      ...(r.evidence?.line ? { line: r.evidence.line } : {}),
      ...(r.evidence ? { evidence: r.evidence } : {}),
      reason: r.reason,
      ...(r.suggestedFix ? { suggestedFix: r.suggestedFix } : {}),
      rerun: allowCommands ? "rulebound check --allow-commands --format repair-json" : "rulebound check --format repair-json",
    })
  }
  const expiredWaivers = report.waiversApplied
    .filter((w) => w.expired)
    .map((w) => ({ rule: w.waiver.rule, expires: w.waiver.expires, reason: w.waiver.reason }))
  console.log(
    JSON.stringify(
      {
        status: report.status,
        summary: report.summary,
        failures: items,
        waived,
        expiredWaivers,
        next: items.length === 0 ? "GREEN — no repair needed" : "Apply smallest fix per failure, rerun the same check.",
      },
      null,
      2,
    ),
  )
}

function printWaiverErrors(errors: readonly WaiverLoadError[], format: string): void {
  if (format === "json" || format === "sarif" || format === "repair-json") {
    console.error(
      JSON.stringify({
        kind: "waiver-load-errors",
        errors: errors.map((e) => ({ path: e.path, index: e.index, message: e.message })),
      }),
    )
    return
  }
  console.error(chalk.red.bold(`waiver load errors (${errors.length}):`))
  for (const e of errors) {
    const where = e.index !== undefined ? `[${e.index}] ` : ""
    console.error(chalk.red(`  ${e.path} ${where}${e.message}`))
  }
}

export async function checkCommand(opts: CheckOptions): Promise<void> {
  const ctx = loadContext(opts)
  if (ctx.rules.length === 0) {
    console.error(chalk.red("No rules found. Run 'rulebound init --examples' or check --dir."))
    process.exit(2)
  }

  const determ = ctx.rules.filter((r) => r.checks && r.checks.length > 0).length
  if (determ === 0) {
    console.error(chalk.yellow("No rule has deterministic checks. Add `checks:` blocks to enforce them deterministically."))
  }

  const waiverLoad = loadWaiversWithErrors(ctx.cwd, opts.waivers)
  if (waiverLoad.errors.length > 0) {
    printWaiverErrors(waiverLoad.errors, opts.format ?? "pretty")
    process.exit(2)
  }
  const report = await validateDeterministic({
    cwd: ctx.cwd,
    rules: ctx.rules,
    changedFiles: ctx.changedFiles,
    ...(ctx.branch !== undefined ? { branch: ctx.branch } : {}),
    allowCommandExecution: opts.allowCommands ?? false,
    waivers: waiverLoad.waivers,
  })

  const rerunHint = (() => {
    const parts = ["rulebound", "check"]
    if (opts.dir) parts.push("--dir", opts.dir)
    if (opts.base) parts.push("--base", opts.base)
    if (opts.staged) parts.push("--staged")
    if (opts.allowCommands) parts.push("--allow-commands")
    if (opts.waivers) parts.push("--waivers", opts.waivers)
    return parts.join(" ")
  })()

  switch (opts.format ?? "pretty") {
    case "json":
      printJson(report)
      break
    case "github":
      printGithub(report)
      break
    case "repair-json":
      printRepairJson(report, opts.allowCommands ?? false)
      break
    case "sarif":
      printSarif(report)
      break
    case "pr-markdown":
      printPrMarkdown(report, rerunHint)
      break
    default:
      printPretty(report)
  }

  if (report.status === "FAILED") process.exit(1)
  if (opts.failOnAdvisory && report.summary.violated > 0) process.exit(3)
  process.exit(0)
}
