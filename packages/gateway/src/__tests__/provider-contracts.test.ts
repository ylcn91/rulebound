import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  appendWarningToResponse,
  extractContentFromSSE,
  extractResponseContent,
  injectRulesForProvider,
  isGenerationRequest,
  isStreamingRequest,
  type Provider,
} from "../provider-adapter.js"

const FIXTURES_DIR = join(fileURLToPath(new URL("./fixtures", import.meta.url)))

interface Fixture {
  description: string
  operations: string[]
  ruleText?: string
  warning?: string
  request?: Record<string, unknown>
  injectedExpect?: Record<string, unknown>
  response?: Record<string, unknown>
  expectedContent?: string | null
  appendedExpect?: Record<string, unknown>
  sseChunk?: string
  expectedSseContent?: string
  path?: string
  isGeneration?: boolean
  isStreaming?: boolean
  body?: Record<string, unknown>
}

function loadFixtures(provider: Provider): Array<{ name: string; data: Fixture }> {
  const dir = join(FIXTURES_DIR, provider)
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => ({
      name: file.replace(/\.json$/, ""),
      data: JSON.parse(readFileSync(join(dir, file), "utf-8")) as Fixture,
    }))
}

function runInject(
  provider: Provider,
  fixture: Fixture,
): Record<string, unknown> {
  if (!fixture.request || fixture.ruleText === undefined) {
    throw new Error("inject fixture missing request or ruleText")
  }
  return injectRulesForProvider(provider, fixture.request, fixture.ruleText)
}

function assertOpenAIInjected(
  result: Record<string, unknown>,
  injectedExpect: Record<string, unknown>,
  fixture: Fixture,
) {
  const messages = result.messages as Array<{ role: string; content: string }>
  expect(Array.isArray(messages)).toBe(true)
  if (typeof injectedExpect.firstMessageRole === "string") {
    expect(messages[0]?.role).toBe(injectedExpect.firstMessageRole)
  }
  if (typeof injectedExpect.firstMessageContent === "string") {
    expect(messages[0]?.content).toBe(injectedExpect.firstMessageContent)
  }
  if (typeof injectedExpect.systemContentEndsWith === "string") {
    const sysIdx = messages.findIndex((m) => m.role === "system")
    expect(sysIdx).toBeGreaterThanOrEqual(0)
    expect(
      (messages[sysIdx].content as string).endsWith(
        injectedExpect.systemContentEndsWith as string,
      ),
    ).toBe(true)
  }
  if (injectedExpect.userPreserved === true) {
    const original = (fixture.request!.messages as Array<{ role: string }>) ?? []
    const originalUserCount = original.filter((m) => m.role === "user").length
    const resultUserCount = messages.filter((m) => m.role === "user").length
    expect(resultUserCount).toBe(originalUserCount)
  }
}

function assertAnthropicInjected(
  result: Record<string, unknown>,
  injectedExpect: Record<string, unknown>,
) {
  if (injectedExpect.systemKind === "string") {
    expect(typeof result.system).toBe("string")
  }
  if (typeof injectedExpect.systemEndsWith === "string") {
    expect((result.system as string).endsWith(injectedExpect.systemEndsWith as string)).toBe(true)
  }
  if (typeof injectedExpect.systemEqual === "string") {
    expect(result.system).toBe(injectedExpect.systemEqual)
  }
}

function assertGoogleInjected(
  result: Record<string, unknown>,
  injectedExpect: Record<string, unknown>,
) {
  if (typeof injectedExpect.systemInstructionFirstText === "string") {
    const instruction = result.systemInstruction as
      | { parts?: Array<{ text?: string }> }
      | undefined
    expect(instruction?.parts?.[0]?.text).toBe(
      injectedExpect.systemInstructionFirstText,
    )
  }
}

function assertOpenAIAppended(
  appended: Record<string, unknown>,
  original: Record<string, unknown>,
  expect_: Record<string, unknown>,
  warning: string,
) {
  if (expect_.unchanged === true) {
    expect(appended).toEqual(original)
    return
  }
  if (typeof expect_.choice0ContentEndsWith === "string") {
    const choices = appended.choices as Array<{
      message?: { content?: string }
    }>
    expect(
      choices[0]?.message?.content?.endsWith(warning),
    ).toBe(true)
    expect(
      choices[0]?.message?.content?.endsWith(
        expect_.choice0ContentEndsWith as string,
      ),
    ).toBe(true)
  }
}

function assertAnthropicAppended(
  appended: Record<string, unknown>,
  _original: Record<string, unknown>,
  expect_: Record<string, unknown>,
) {
  const content = appended.content as Array<{ type: string; text?: string }>
  expect(Array.isArray(content)).toBe(true)
  if (typeof expect_.lastBlockType === "string") {
    expect(content[content.length - 1]?.type).toBe(expect_.lastBlockType)
  }
  if (typeof expect_.contentLastTextEndsWith === "string") {
    expect(
      content[content.length - 1]?.text?.endsWith(
        expect_.contentLastTextEndsWith as string,
      ),
    ).toBe(true)
  }
}

function assertGoogleAppended(
  appended: Record<string, unknown>,
  _original: Record<string, unknown>,
  expect_: Record<string, unknown>,
) {
  const candidates = appended.candidates as Array<{
    content: { parts: Array<{ text?: string }> }
  }>
  expect(Array.isArray(candidates)).toBe(true)
  if (typeof expect_.candidate0LastPartTextEndsWith === "string") {
    const parts = candidates[0].content.parts
    expect(
      parts[parts.length - 1]?.text?.endsWith(
        expect_.candidate0LastPartTextEndsWith as string,
      ),
    ).toBe(true)
  }
}

const ASSERT_INJECT: Record<
  Provider,
  (
    result: Record<string, unknown>,
    injectedExpect: Record<string, unknown>,
    fixture: Fixture,
  ) => void
> = {
  openai: assertOpenAIInjected,
  anthropic: assertAnthropicInjected,
  google: assertGoogleInjected,
}

const ASSERT_APPEND: Record<
  Provider,
  (
    appended: Record<string, unknown>,
    original: Record<string, unknown>,
    expect_: Record<string, unknown>,
    warning: string,
  ) => void
> = {
  openai: assertOpenAIAppended,
  anthropic: assertAnthropicAppended,
  google: assertGoogleAppended,
}

const PROVIDERS: Provider[] = ["openai", "anthropic", "google"]

describe("provider contract fixtures", () => {
  for (const provider of PROVIDERS) {
    describe(provider, () => {
      const fixtures = loadFixtures(provider)
      expect(fixtures.length).toBeGreaterThanOrEqual(5)

      for (const { name, data } of fixtures) {
        describe(name, () => {
          const ops = new Set(data.operations)

          if (ops.has("inject")) {
            it("injects rules into request", () => {
              const result = runInject(provider, data)
              if (data.injectedExpect) {
                ASSERT_INJECT[provider](result, data.injectedExpect, data)
              }
            })
          }

          if (ops.has("extract")) {
            it("extracts response content", () => {
              if (!data.response) throw new Error("missing response body")
              const text = extractResponseContent(provider, data.response)
              if (data.expectedContent === null || data.expectedContent === undefined) {
                expect(text).toBeNull()
              } else {
                expect(text).toBe(data.expectedContent)
              }
            })
          }

          if (ops.has("extractSSE")) {
            it("extracts content from SSE stream chunk", () => {
              if (data.sseChunk === undefined) throw new Error("missing sseChunk")
              const text = extractContentFromSSE(provider, data.sseChunk)
              expect(text).toBe(data.expectedSseContent ?? "")
            })
          }

          if (ops.has("appendWarning")) {
            it("appends warning to response", () => {
              if (!data.response || data.warning === undefined) {
                throw new Error("missing response or warning")
              }
              const original = JSON.parse(JSON.stringify(data.response))
              const appended = appendWarningToResponse(
                provider,
                data.response,
                data.warning,
              )
              if (data.appendedExpect) {
                ASSERT_APPEND[provider](
                  appended,
                  original,
                  data.appendedExpect,
                  data.warning,
                )
              }
            })
          }

          if (ops.has("passthrough")) {
            it("classifies passthrough path as non-generation", () => {
              if (data.path === undefined) throw new Error("missing path")
              expect(isGenerationRequest(provider, data.path)).toBe(
                data.isGeneration ?? false,
              )
              expect(
                isStreamingRequest(provider, data.path, data.body ?? {}),
              ).toBe(data.isStreaming ?? false)
            })
          }
        })
      }
    })
  }
})
