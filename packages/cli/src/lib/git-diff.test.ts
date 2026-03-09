import { beforeEach, describe, expect, it, vi } from "vitest"

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
}))

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}))

import { extractAddedLines, extractChangedFiles, readGitDiff } from "./git-diff.js"

describe("readGitDiff", () => {
  beforeEach(() => {
    execFileSyncMock.mockReset()
  })

  it("reads staged diff explicitly", () => {
    execFileSyncMock.mockReturnValue("staged diff")

    const selection = readGitDiff({ staged: true })

    expect(selection).toEqual({
      diffText: "staged diff",
      kind: "staged",
      label: "staged changes",
    })
    expect(execFileSyncMock).toHaveBeenCalledWith("git", ["diff", "--cached"], { encoding: "utf-8" })
  })

  it("reads diff against an explicit ref", () => {
    execFileSyncMock.mockReturnValue("ref diff")

    const selection = readGitDiff({ ref: "main" })

    expect(selection).toEqual({
      diffText: "ref diff",
      kind: "ref",
      label: "main",
    })
    expect(execFileSyncMock).toHaveBeenCalledWith("git", ["diff", "main"], { encoding: "utf-8" })
  })

  it("falls back to staged diff when HEAD is unavailable", () => {
    execFileSyncMock
      .mockImplementationOnce(() => {
        throw new Error("no HEAD")
      })
      .mockReturnValueOnce("staged fallback")

    const selection = readGitDiff({})

    expect(selection).toEqual({
      diffText: "staged fallback",
      kind: "staged",
      label: "staged changes",
    })
    expect(execFileSyncMock).toHaveBeenNthCalledWith(1, "git", ["diff", "HEAD"], { encoding: "utf-8" })
    expect(execFileSyncMock).toHaveBeenNthCalledWith(2, "git", ["diff", "--cached"], { encoding: "utf-8" })
  })

  it("rejects combining staged and ref options", () => {
    expect(() => readGitDiff({ staged: true, ref: "HEAD" })).toThrow("Cannot combine --staged with --ref.")
  })
})

describe("diff extraction helpers", () => {
  const diffText = [
    "diff --git a/src/app.ts b/src/app.ts",
    "+++ b/src/app.ts",
    "@@",
    "+const apiKey = process.env.API_KEY",
    " unchanged",
    "diff --git a/src/test.ts b/src/test.ts",
    "+++ b/src/test.ts",
    "@@",
    "+expect(true).toBe(true)",
  ].join("\n")

  it("extracts added lines without file headers", () => {
    expect(extractAddedLines(diffText)).toBe(
      ["const apiKey = process.env.API_KEY", "expect(true).toBe(true)"].join("\n")
    )
  })

  it("extracts changed file paths", () => {
    expect(extractChangedFiles(diffText)).toEqual(["src/app.ts", "src/test.ts"])
  })
})
