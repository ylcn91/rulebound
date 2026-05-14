import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import type { AnalyzerCheck, CheckResult } from "../types.js"

export interface AnalyzerRunOptions {
  readonly cwd: string
  readonly ruleId: string
  readonly check: AnalyzerCheck
  readonly allowCommandExecution: boolean
}

interface AnalyzerFinding {
  readonly file?: string
  readonly line?: number
  readonly severity: "error" | "warning" | "info"
  readonly rule?: string
  readonly message: string
}

function attr(xml: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`)
  const m = xml.match(re)
  return m ? m[1] : undefined
}

function parsePmdXml(content: string): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = []
  const fileBlockRe = /<file\b[^>]*>([\s\S]*?)<\/file>/g
  let fm: RegExpExecArray | null
  while ((fm = fileBlockRe.exec(content)) !== null) {
    const header = fm[0].slice(0, fm[0].indexOf(">") + 1)
    const file = attr(header, "name")
    const inner = fm[1]
    const vioRe = /<violation\b[^>]*>([\s\S]*?)<\/violation>/g
    let v: RegExpExecArray | null
    while ((v = vioRe.exec(inner)) !== null) {
      const open = v[0].slice(0, v[0].indexOf(">") + 1)
      const lineStr = attr(open, "beginline") ?? attr(open, "line")
      const ruleName = attr(open, "rule")
      const priority = attr(open, "priority")
      const severity = priority && Number(priority) <= 2 ? "error" : "warning"
      findings.push({
        ...(file ? { file } : {}),
        ...(lineStr ? { line: Number(lineStr) } : {}),
        ...(ruleName ? { rule: ruleName } : {}),
        severity,
        message: v[1].replace(/<[^>]+>/g, "").trim(),
      })
    }
  }
  return findings
}

function parseCheckstyleXml(content: string): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = []
  const fileBlockRe = /<file\b[^>]*>([\s\S]*?)<\/file>/g
  let fm: RegExpExecArray | null
  while ((fm = fileBlockRe.exec(content)) !== null) {
    const header = fm[0].slice(0, fm[0].indexOf(">") + 1)
    const file = attr(header, "name")
    const inner = fm[1]
    const errRe = /<error\b[^/]*\/>/g
    let v: RegExpExecArray | null
    while ((v = errRe.exec(inner)) !== null) {
      const open = v[0]
      const lineStr = attr(open, "line")
      const sev = (attr(open, "severity") ?? "warning") as AnalyzerFinding["severity"]
      const message = attr(open, "message") ?? "Checkstyle violation"
      const source = attr(open, "source")
      findings.push({
        ...(file ? { file } : {}),
        ...(lineStr ? { line: Number(lineStr) } : {}),
        ...(source ? { rule: source } : {}),
        severity: sev === "info" || sev === "error" || sev === "warning" ? sev : "warning",
        message,
      })
    }
  }
  return findings
}

function parseSpotbugsXml(content: string): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = []
  const bugRe = /<BugInstance\b[^>]*>([\s\S]*?)<\/BugInstance>/g
  let m: RegExpExecArray | null
  while ((m = bugRe.exec(content)) !== null) {
    const open = m[0].slice(0, m[0].indexOf(">") + 1)
    const type = attr(open, "type") ?? "spotbugs"
    const priority = attr(open, "priority")
    const sev: AnalyzerFinding["severity"] = priority && Number(priority) === 1 ? "error" : "warning"
    const inner = m[1]
    const srcMatch = inner.match(/<SourceLine\b[^>]*\/>/)
    const file = srcMatch ? attr(srcMatch[0], "sourcepath") : undefined
    const lineStr = srcMatch ? attr(srcMatch[0], "start") : undefined
    const msgMatch = inner.match(/<LongMessage>([\s\S]*?)<\/LongMessage>/)
    const message = msgMatch ? msgMatch[1].trim() : type
    findings.push({
      ...(file ? { file } : {}),
      ...(lineStr ? { line: Number(lineStr) } : {}),
      rule: type,
      severity: sev,
      message,
    })
  }
  return findings
}

function parseJunitXml(content: string): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = []
  const tcRe = /<testcase\b[^>]*>([\s\S]*?)<\/testcase>/g
  let m: RegExpExecArray | null
  while ((m = tcRe.exec(content)) !== null) {
    const open = m[0].slice(0, m[0].indexOf(">") + 1)
    const inner = m[1]
    const name = attr(open, "name") ?? "(test)"
    const className = attr(open, "classname")
    const failure = inner.match(/<(failure|error)\b[^>]*>([\s\S]*?)<\/\1>/)
    if (failure) {
      const msg = attr(failure[0].slice(0, failure[0].indexOf(">") + 1), "message") ?? failure[2].trim().slice(0, 500)
      findings.push({
        ...(className ? { file: className } : {}),
        rule: name,
        severity: "error",
        message: msg,
      })
    }
  }
  return findings
}

interface EslintMessage {
  readonly ruleId?: string | null
  readonly severity?: number
  readonly message?: string
  readonly line?: number
  readonly column?: number
}

interface EslintFileReport {
  readonly filePath?: string
  readonly messages?: readonly EslintMessage[]
}

function parseEslintJson(content: string): AnalyzerFinding[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const arr = parsed as readonly EslintFileReport[]
  if (arr.length === 0) return []
  if (!arr.every((entry) => entry && typeof entry === "object" && Array.isArray((entry as EslintFileReport).messages))) {
    return null
  }
  const findings: AnalyzerFinding[] = []
  for (const fileReport of arr) {
    for (const m of fileReport.messages ?? []) {
      const sev: AnalyzerFinding["severity"] = m.severity === 2 ? "error" : m.severity === 1 ? "warning" : "info"
      findings.push({
        ...(fileReport.filePath ? { file: fileReport.filePath } : {}),
        ...(m.line ? { line: m.line } : {}),
        ...(m.ruleId ? { rule: m.ruleId } : {}),
        severity: sev,
        message: m.message ?? m.ruleId ?? "ESLint finding",
      })
    }
  }
  return findings
}

function parseSarif(content: string): AnalyzerFinding[] {
  try {
    const json = JSON.parse(content) as {
      runs?: {
        results?: {
          ruleId?: string
          message?: { text?: string }
          level?: string
          locations?: { physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number } } }[]
        }[]
      }[]
    }
    const findings: AnalyzerFinding[] = []
    for (const run of json.runs ?? []) {
      for (const r of run.results ?? []) {
        const loc = r.locations?.[0]?.physicalLocation
        const file = loc?.artifactLocation?.uri
        const line = loc?.region?.startLine
        const sev: AnalyzerFinding["severity"] =
          r.level === "error" ? "error" : r.level === "note" ? "info" : "warning"
        findings.push({
          ...(file ? { file } : {}),
          ...(line ? { line } : {}),
          ...(r.ruleId ? { rule: r.ruleId } : {}),
          severity: sev,
          message: r.message?.text ?? r.ruleId ?? "SARIF finding",
        })
      }
    }
    return findings
  } catch {
    return []
  }
}

function detectFormat(check: AnalyzerCheck): AnalyzerCheck["report_format"] {
  if (check.report_format) return check.report_format
  switch (check.analyzer) {
    case "pmd":
      return "pmd-xml"
    case "checkstyle":
      return "checkstyle-xml"
    case "spotbugs":
      return "spotbugs-xml"
    case "junit":
      return "junit-xml"
    case "semgrep":
    case "gitleaks":
      return "sarif"
    default:
      return "text"
  }
}

export function runAnalyzerCheck(opts: AnalyzerRunOptions): CheckResult {
  const { cwd, ruleId, check, allowCommandExecution } = opts
  const checkId = check.id ?? `analyzer:${check.analyzer}`
  const severity = check.severity ?? "error"

  if (check.run) {
    if (!allowCommandExecution) {
      return {
        ruleId,
        checkId,
        status: "NOT_APPLICABLE",
        source: "analyzer",
        deterministic: true,
        confidence: "exact",
        blocking: false,
        reason: `Analyzer with 'run' requires --allow-commands. Skipped: ${check.run}`,
      }
    }
    const passCodes = check.pass_exit_codes ?? [0]
    const result = spawnSync("/bin/sh", ["-c", check.run], {
      cwd,
      timeout: check.timeout_ms ?? 600_000,
      encoding: "utf-8",
      maxBuffer: 16 * 1024 * 1024,
    })
    if (result.error) {
      return {
        ruleId,
        checkId,
        status: "ERROR",
        source: "analyzer",
        deterministic: true,
        confidence: "exact",
        blocking: false,
        reason: `Analyzer command failed: ${result.error.message}`,
        evidence: { command: check.run, analyzerReport: check.report },
      }
    }
    const exitCode = result.status ?? -1
    if (!passCodes.includes(exitCode)) {
      return {
        ruleId,
        checkId,
        status: "VIOLATED",
        source: "analyzer",
        deterministic: true,
        confidence: "exact",
        blocking: severity === "error",
        reason: check.message ?? `${check.analyzer} exited with code ${exitCode}`,
        evidence: {
          command: check.run,
          exitCode,
          stdout: (result.stdout ?? "").slice(0, 16_384),
          stderr: (result.stderr ?? "").slice(0, 16_384),
        },
      }
    }
  }

  const reportPath = resolve(cwd, check.report)
  if (!existsSync(reportPath)) {
    const hint = check.run
      ? `Run the analyzer first or pass --allow-commands so rulebound can run \`${check.run}\` itself.`
      : `Run the analyzer (or your build) that emits this report, then re-run rulebound check.`
    return {
      ruleId,
      checkId,
      status: "ERROR",
      source: "analyzer",
      deterministic: true,
      confidence: "exact",
      blocking: false,
      reason: `Analyzer report not found: ${check.report}. ${hint}`,
      evidence: { analyzerReport: check.report, ...(check.run ? { command: check.run } : {}) },
    }
  }

  let raw: string
  try {
    raw = readFileSync(reportPath, "utf-8")
  } catch (error) {
    return {
      ruleId,
      checkId,
      status: "ERROR",
      source: "analyzer",
      deterministic: true,
      confidence: "exact",
      blocking: false,
      reason: `Could not read analyzer report: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  const fmt = detectFormat(check)
  let findings: AnalyzerFinding[] = []
  switch (fmt) {
    case "pmd-xml":
      findings = parsePmdXml(raw)
      break
    case "checkstyle-xml":
      findings = parseCheckstyleXml(raw)
      break
    case "spotbugs-xml":
      findings = parseSpotbugsXml(raw)
      break
    case "junit-xml":
      findings = parseJunitXml(raw)
      break
    case "sarif":
      findings = parseSarif(raw)
      break
    case "json":
      if (check.analyzer === "eslint") {
        findings = parseEslintJson(raw) ?? []
      } else {
        try {
          const parsed = JSON.parse(raw) as { findings?: AnalyzerFinding[] }
          findings = parsed.findings ?? []
        } catch {
          findings = []
        }
      }
      break
    default:
      findings = []
  }

  const failOn = check.fail_on_severity ?? "warning"
  const rank = { info: 0, warning: 1, error: 2 } as const
  const blockingFindings = findings.filter((f) => rank[f.severity] >= rank[failOn])

  if (blockingFindings.length === 0) {
    return {
      ruleId,
      checkId,
      status: "PASS",
      source: "analyzer",
      deterministic: true,
      confidence: "exact",
      blocking: false,
      reason: `${check.analyzer}: 0 findings >= ${failOn} (total: ${findings.length})`,
      evidence: { analyzerReport: check.report },
    }
  }

  const first = blockingFindings[0]
  return {
    ruleId,
    checkId,
    status: "VIOLATED",
    source: "analyzer",
    deterministic: true,
    confidence: "exact",
    blocking: severity === "error",
    reason:
      check.message ??
      `${check.analyzer}: ${blockingFindings.length} finding(s) >= ${failOn}. First: ${first.message}`,
    evidence: {
      analyzerReport: check.report,
      ...(first.file ? { filePath: first.file } : {}),
      ...(first.line ? { line: first.line } : {}),
      matches: blockingFindings.slice(0, 20).map((f) => `[${f.severity}] ${f.file ?? ""}:${f.line ?? ""} ${f.message}`),
    },
  }
}
