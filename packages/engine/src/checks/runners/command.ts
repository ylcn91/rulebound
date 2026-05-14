import { spawnSync } from "node:child_process"
import type { CheckResult, CommandCheck } from "../types.js"

export interface CommandRunOptions {
  readonly cwd: string
  readonly ruleId: string
  readonly check: CommandCheck
  readonly allowCommandExecution: boolean
  readonly extraEnvAllowlist?: readonly string[]
}

const DEFAULT_ENV_ALLOWLIST: readonly string[] = [
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "USER",
  "SHELL",
  "TMPDIR",
  "PWD",
  "NODE_OPTIONS",
  "JAVA_HOME",
  "MAVEN_HOME",
  "GRADLE_HOME",
  "PYTHONPATH",
  "VIRTUAL_ENV",
  "PNPM_HOME",
]

const STDOUT_MAX = 32_768

function truncate(s: string, max = STDOUT_MAX): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n... [truncated ${s.length - max} bytes]`
}

function buildEnv(check: CommandCheck, extra?: readonly string[]): Record<string, string> {
  const allowlist = new Set<string>([
    ...DEFAULT_ENV_ALLOWLIST,
    ...(check.env_allowlist ?? []),
    ...(extra ?? []),
  ])
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (allowlist.has(k) && v !== undefined) env[k] = v
  }
  if (check.env) {
    for (const [k, v] of Object.entries(check.env)) {
      env[k] = v
    }
  }
  return env
}

export function runCommandCheck(opts: CommandRunOptions): CheckResult {
  const { cwd, ruleId, check, allowCommandExecution } = opts
  const checkId = check.id ?? `command:${check.run.slice(0, 50)}`

  if (!allowCommandExecution) {
    return {
      ruleId,
      checkId,
      status: "NOT_APPLICABLE",
      source: "command",
      deterministic: true,
      confidence: "exact",
      blocking: false,
      reason: `Command checks require --allow-commands (opt-in). Skipped: '${check.run}'`,
    }
  }

  const timeoutMs = check.timeout_ms ?? 120_000
  const passCodes = check.pass_exit_codes ?? [0]
  const env = buildEnv(check, opts.extraEnvAllowlist)
  const workingDir = check.cwd ? new URL(check.cwd, `file://${cwd}/`).pathname : cwd

  const result = spawnSync("/bin/sh", ["-c", check.run], {
    cwd: workingDir,
    env,
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    encoding: "utf-8",
  })

  if (result.error) {
    return {
      ruleId,
      checkId,
      status: "ERROR",
      source: "command",
      deterministic: true,
      confidence: "exact",
      blocking: false,
      reason: `Command failed to start: ${result.error.message}`,
      evidence: { command: check.run },
    }
  }

  const exitCode = result.status ?? -1
  const passed = passCodes.includes(exitCode)
  const severity = check.severity ?? "error"

  return {
    ruleId,
    checkId,
    status: passed ? "PASS" : "VIOLATED",
    source: "command",
    deterministic: true,
    confidence: "exact",
    blocking: !passed && severity === "error",
    reason: passed
      ? `Command exited with code ${exitCode}`
      : check.message ?? `Command '${check.run}' exited with code ${exitCode}`,
    evidence: {
      command: check.run,
      exitCode,
      stdout: truncate(result.stdout ?? ""),
      stderr: truncate(result.stderr ?? ""),
    },
  }
}
