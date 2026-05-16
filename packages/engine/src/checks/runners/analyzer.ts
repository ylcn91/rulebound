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

interface ParsedAnalyzerReport {
  readonly findings: AnalyzerFinding[]
  readonly error?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function ok(findings: AnalyzerFinding[]): ParsedAnalyzerReport {
  return { findings }
}

function malformed(error: string): ParsedAnalyzerReport {
  return { findings: [], error }
}

function attr(xml: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`)
  const m = xml.match(re)
  return m ? m[1] : undefined
}

function findXmlTagEnd(xml: string, start: number): number {
  let quote: '"' | "'" | null = null

  for (let i = start; i < xml.length; i++) {
    const ch = xml[i]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === ">") return i
  }

  return -1
}

function validateXmlReport(content: string, expectedRoots: readonly string[]): string | undefined {
  const xml = content.trim()
  if (!xml) return "report is empty"

  const stack: string[] = []
  let root: string | undefined
  let rootClosed = false
  let i = 0

  while (i < xml.length) {
    const lt = xml.indexOf("<", i)
    if (lt === -1) break

    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt + 4)
      if (end === -1) return "unterminated XML comment"
      i = end + 3
      continue
    }

    if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt + 9)
      if (end === -1) return "unterminated XML CDATA section"
      i = end + 3
      continue
    }

    if (xml.startsWith("<?", lt)) {
      const end = xml.indexOf("?>", lt + 2)
      if (end === -1) return "unterminated XML processing instruction"
      i = end + 2
      continue
    }

    if (xml.startsWith("<!", lt)) {
      const end = findXmlTagEnd(xml, lt + 2)
      if (end === -1) return "unterminated XML declaration"
      i = end + 1
      continue
    }

    const gt = findXmlTagEnd(xml, lt + 1)
    if (gt === -1) return "unterminated XML tag"

    const tag = xml.slice(lt + 1, gt).trim()
    if (!tag) return "empty XML tag"

    if (tag.startsWith("/")) {
      const name = /^\/\s*([A-Za-z_][A-Za-z0-9_.:-]*)\s*$/.exec(tag)?.[1]
      if (!name) return "invalid XML closing tag"
      const open = stack.pop()
      if (open !== name) return `mismatched XML closing tag: expected </${open ?? "(none)"}>, found </${name}>`
      if (stack.length === 0) rootClosed = true
      i = gt + 1
      continue
    }

    const name = /^([A-Za-z_][A-Za-z0-9_.:-]*)\b/.exec(tag)?.[1]
    if (!name) return "invalid XML tag"
    if (rootClosed && stack.length === 0) return "multiple XML root elements"
    if (!root) root = name

    const selfClosing = /\/\s*$/.test(tag)
    if (!selfClosing) {
      stack.push(name)
    } else if (stack.length === 0) {
      rootClosed = true
    }

    i = gt + 1
  }

  if (!root) return "missing XML root element"
  if (!expectedRoots.includes(root)) {
    return `expected XML root <${expectedRoots.join("|")}>, found <${root}>`
  }
  if (stack.length > 0) return `unclosed XML tag <${stack[stack.length - 1]}>`

  return undefined
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

function parseEslintJson(content: string): ParsedAnalyzerReport {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch (error) {
    return malformed(`invalid ESLint JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(parsed)) return malformed("expected ESLint JSON array")
  const arr = parsed as readonly EslintFileReport[]
  if (arr.length === 0) return ok([])
  if (!arr.every((entry) => isRecord(entry) && Array.isArray((entry as EslintFileReport).messages))) {
    return malformed("expected every ESLint file report to include a messages array")
  }
  const findings: AnalyzerFinding[] = []
  for (const fileReport of arr) {
    if (fileReport.filePath !== undefined && typeof fileReport.filePath !== "string") {
      return malformed("expected ESLint filePath to be a string")
    }
    for (const m of fileReport.messages ?? []) {
      if (!isRecord(m)) return malformed("expected ESLint messages to be objects")
      if (m.ruleId !== undefined && m.ruleId !== null && typeof m.ruleId !== "string") {
        return malformed("expected ESLint ruleId to be a string or null")
      }
      if (m.severity !== undefined && typeof m.severity !== "number") {
        return malformed("expected ESLint severity to be numeric")
      }
      if (m.message !== undefined && typeof m.message !== "string") {
        return malformed("expected ESLint message to be a string")
      }
      if (m.line !== undefined && typeof m.line !== "number") {
        return malformed("expected ESLint line to be numeric")
      }
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
  return ok(findings)
}

function parseSarif(content: string): ParsedAnalyzerReport {
  try {
    const json = JSON.parse(content) as unknown
    if (!isRecord(json)) return malformed("expected SARIF object")
    if (!Array.isArray(json.runs)) return malformed("expected SARIF runs array")

    const findings: AnalyzerFinding[] = []
    for (const run of json.runs) {
      if (!isRecord(run)) return malformed("expected SARIF run to be an object")
      if (run.results !== undefined && !Array.isArray(run.results)) {
        return malformed("expected SARIF run results to be an array")
      }

      for (const result of (run.results as readonly unknown[] | undefined) ?? []) {
        if (!isRecord(result)) return malformed("expected SARIF result to be an object")
        if (result.locations !== undefined && !Array.isArray(result.locations)) {
          return malformed("expected SARIF result locations to be an array")
        }

        const firstLocation = Array.isArray(result.locations) ? result.locations[0] : undefined
        const physicalLocation = isRecord(firstLocation) ? firstLocation.physicalLocation : undefined
        const physical = isRecord(physicalLocation) ? physicalLocation : undefined
        const artifactLocation = isRecord(physical?.artifactLocation) ? physical.artifactLocation : undefined
        const region = isRecord(physical?.region) ? physical.region : undefined
        const file = typeof artifactLocation?.uri === "string" ? artifactLocation.uri : undefined
        const line = typeof region?.startLine === "number" ? region.startLine : undefined
        const ruleId = typeof result.ruleId === "string" ? result.ruleId : undefined
        const message = isRecord(result.message) && typeof result.message.text === "string" ? result.message.text : undefined
        const level = typeof result.level === "string" ? result.level : undefined
        const sev: AnalyzerFinding["severity"] =
          level === "error" ? "error" : level === "note" ? "info" : "warning"
        findings.push({
          ...(file ? { file } : {}),
          ...(line ? { line } : {}),
          ...(ruleId ? { rule: ruleId } : {}),
          severity: sev,
          message: message ?? ruleId ?? "SARIF finding",
        })
      }
    }
    return ok(findings)
  } catch (error) {
    return malformed(`invalid SARIF JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function parseGenericJson(content: string): ParsedAnalyzerReport {
  try {
    const parsed = JSON.parse(content) as unknown
    return ok(isRecord(parsed) && Array.isArray(parsed.findings) ? (parsed.findings as AnalyzerFinding[]) : [])
  } catch (error) {
    return malformed(`invalid JSON report: ${error instanceof Error ? error.message : String(error)}`)
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
  let parseError: string | undefined
  switch (fmt) {
    case "pmd-xml": {
      parseError = validateXmlReport(raw, ["pmd"])
      if (!parseError) findings = parsePmdXml(raw)
      break
    }
    case "checkstyle-xml": {
      parseError = validateXmlReport(raw, ["checkstyle"])
      if (!parseError) findings = parseCheckstyleXml(raw)
      break
    }
    case "spotbugs-xml": {
      parseError = validateXmlReport(raw, ["BugCollection"])
      if (!parseError) findings = parseSpotbugsXml(raw)
      break
    }
    case "junit-xml": {
      parseError = validateXmlReport(raw, ["testsuite", "testsuites"])
      if (!parseError) findings = parseJunitXml(raw)
      break
    }
    case "sarif": {
      const parsed = parseSarif(raw)
      parseError = parsed.error
      findings = parsed.findings
      break
    }
    case "json": {
      const parsed = check.analyzer === "eslint" ? parseEslintJson(raw) : parseGenericJson(raw)
      parseError = parsed.error
      findings = parsed.findings
      break
    }
    default:
      findings = []
  }

  if (parseError) {
    return {
      ruleId,
      checkId,
      status: "ERROR",
      source: "analyzer",
      deterministic: true,
      confidence: "exact",
      blocking: false,
      reason: `Malformed analyzer report (${fmt ?? "unknown"}): ${parseError}`,
      evidence: { analyzerReport: check.report },
    }
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
