import { describe, expect, it } from "vitest"
import {
  appendWarningToResponse,
  buildStreamWarningMessage,
  extractContentFromSSE,
  extractResponseContent,
  injectRulesForProvider,
} from "../provider-adapter.js"

describe("google provider adapter", () => {
  it("injects rules into Gemini system instructions", () => {
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: "Write code" }],
        },
      ],
    }

    const injected = injectRulesForProvider("google", body, "RULES HERE")

    expect(injected.systemInstruction).toEqual({
      parts: [{ text: "RULES HERE" }],
    })
  })

  it("extracts Gemini candidate text for non-streaming responses", () => {
    const text = extractResponseContent("google", {
      candidates: [
        {
          content: {
            parts: [{ text: "```ts\nconst x = 1\n```" }],
          },
        },
      ],
    })

    expect(text).toBe("```ts\nconst x = 1\n```")
  })

  it("appends warnings to Gemini candidate parts", () => {
    const updated = appendWarningToResponse("google", {
      candidates: [
        {
          content: {
            parts: [{ text: "Original" }],
          },
        },
      ],
    }, "Warning text")

    const candidates = updated.candidates as Array<{ content: { parts: Array<{ text: string }> } }>
    expect(candidates[0].content.parts).toEqual([
      { text: "Original" },
      { text: "Warning text" },
    ])
  })

  it("extracts Gemini streaming text from SSE chunks", () => {
    const chunk = `data: ${JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: "```ts\nconst x = 1\n```" }],
          },
        },
      ],
    })}\n\n`

    expect(extractContentFromSSE("google", chunk)).toBe("```ts\nconst x = 1\n```")
  })

  it("formats Gemini warning chunks as candidate content", () => {
    const chunk = buildStreamWarningMessage("google", "Rulebound warning")
    expect(chunk).toContain("\"candidates\"")
    expect(chunk).toContain("Rulebound warning")
  })
})
