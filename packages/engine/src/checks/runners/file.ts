import { existsSync } from "node:fs"
import { resolve } from "node:path"
import type { CheckResult, FileExistsCheck, FileNotExistsCheck } from "../types.js"

export interface FileRunOptions {
  readonly cwd: string
  readonly ruleId: string
  readonly check: FileExistsCheck | FileNotExistsCheck
}

export function runFileCheck(opts: FileRunOptions): CheckResult {
  const { cwd, ruleId, check } = opts
  const absPath = resolve(cwd, check.path)
  const present = existsSync(absPath)
  const checkId = check.id ?? `${check.type}:${check.path}`
  const expectPresent = check.type === "file-exists"
  const ok = expectPresent ? present : !present

  return {
    ruleId,
    checkId,
    status: ok ? "PASS" : "VIOLATED",
    source: "file",
    deterministic: true,
    confidence: "exact",
    blocking: (check.severity ?? "error") === "error" && !ok,
    reason: ok
      ? expectPresent
        ? `Required file exists: ${check.path}`
        : `Forbidden file absent: ${check.path}`
      : expectPresent
        ? check.message ?? `Required file missing: ${check.path}`
        : check.message ?? `Forbidden file present: ${check.path}`,
    evidence: { filePath: check.path },
    ...(check.description ? { suggestedFix: check.description } : {}),
  }
}
