import { execFileSync } from "node:child_process"

export interface DiffSelectionOptions {
  readonly ref?: string
  readonly staged?: boolean
}

export interface DiffSelection {
  readonly diffText: string
  readonly kind: "ref" | "staged"
  readonly label: string
}

const SAFE_REF_PATTERN = /^[a-zA-Z0-9._\-/~^]+$/

export function readGitDiff(options: DiffSelectionOptions): DiffSelection {
  if (options.staged && options.ref) {
    throw new Error("Cannot combine --staged with --ref.")
  }

  if (options.staged) {
    return {
      diffText: execFileSync("git", ["diff", "--cached"], { encoding: "utf-8" }),
      kind: "staged",
      label: "staged changes",
    }
  }

  const ref = options.ref ?? "HEAD"
  if (!SAFE_REF_PATTERN.test(ref)) {
    throw new Error(
      `Invalid ref: "${ref}". Only alphanumeric, '.', '_', '-', '/', '~', '^' allowed.`
    )
  }

  try {
    return {
      diffText: execFileSync("git", ["diff", ref], { encoding: "utf-8" }),
      kind: "ref",
      label: ref,
    }
  } catch (_error) {
    if (options.ref !== undefined) {
      throw new Error(`Failed to get git diff for ref "${ref}". Are you in a git repository?`)
    }

    return {
      diffText: execFileSync("git", ["diff", "--cached"], { encoding: "utf-8" }),
      kind: "staged",
      label: "staged changes",
    }
  }
}

export function extractAddedLines(diffText: string): string {
  return diffText
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n")
}

export function extractChangedFiles(diffText: string): string[] {
  return diffText
    .split("\n")
    .filter((line) => line.startsWith("+++ b/"))
    .map((line) => line.replace(/^\+\+\+ b\//, ""))
}
