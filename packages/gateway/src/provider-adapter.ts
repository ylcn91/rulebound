import {
  injectRulesAnthropic,
  injectRulesGoogle,
  injectRulesOpenAI,
} from "./interceptor/pre-request.js"

export type Provider = "openai" | "anthropic" | "google"

type JsonRecord = Record<string, unknown>

export function isGenerationRequest(provider: Provider, path: string): boolean {
  switch (provider) {
    case "anthropic":
      return path.includes("/messages")
    case "google":
      return path.includes(":generateContent") || path.includes(":streamGenerateContent")
    case "openai":
    default:
      return path.includes("/chat/completions")
  }
}

export function isStreamingRequest(provider: Provider, path: string, body: JsonRecord): boolean {
  if (provider === "google") {
    return path.includes(":streamGenerateContent")
  }
  return body.stream === true
}

export function injectRulesForProvider(
  provider: Provider,
  body: JsonRecord,
  ruleText: string,
): JsonRecord {
  switch (provider) {
    case "anthropic":
      return injectRulesAnthropic(body, ruleText)
    case "google":
      return injectRulesGoogle(body, ruleText)
    case "openai":
    default:
      return injectRulesOpenAI(body, ruleText)
  }
}

export function extractResponseContent(
  provider: Provider,
  body: JsonRecord,
): string | null {
  switch (provider) {
    case "anthropic": {
      const content = body.content as Array<{ type: string; text?: string }> | undefined
      if (content) return content.map((part) => part.text ?? "").join("\n")
      return null
    }
    case "google": {
      const text = readGoogleCandidateText(body)
      return text.length > 0 ? text : null
    }
    case "openai":
    default: {
      const choices = body.choices as Array<{ message?: { content?: string } }> | undefined
      return choices?.[0]?.message?.content ?? null
    }
  }
}

export function appendWarningToResponse(
  provider: Provider,
  body: JsonRecord,
  warning: string,
): JsonRecord {
  switch (provider) {
    case "anthropic": {
      const content = body.content as Array<{ type: string; text?: string }> | undefined
      if (content) {
        return {
          ...body,
          content: [...content, { type: "text", text: warning }],
        }
      }
      return body
    }
    case "google": {
      const candidates = body.candidates as Array<JsonRecord> | undefined
      if (!candidates?.[0]) return body

      const updatedCandidates = [...candidates]
      const current = updatedCandidates[0]
      const content = (current.content as JsonRecord | undefined) ?? {}
      const parts = Array.isArray(content.parts) ? [...content.parts] : []

      parts.push({ text: warning })
      updatedCandidates[0] = {
        ...current,
        content: {
          ...content,
          parts,
        },
      }

      return {
        ...body,
        candidates: updatedCandidates,
      }
    }
    case "openai":
    default: {
      const choices = body.choices as Array<{ message?: { content?: string }; [key: string]: unknown }> | undefined
      if (choices?.[0]?.message?.content) {
        const modifiedChoices = [...choices]
        modifiedChoices[0] = {
          ...modifiedChoices[0],
          message: {
            ...modifiedChoices[0].message,
            content: modifiedChoices[0].message!.content + warning,
          },
        }
        return { ...body, choices: modifiedChoices }
      }
      return body
    }
  }
}

export function extractContentFromSSE(
  provider: Provider,
  chunk: string,
): string {
  const lines = chunk.split("\n").filter((line) => line.startsWith("data: "))
  let content = ""

  for (const line of lines) {
    const data = line.slice(6)
    if (data === "[DONE]") continue

    try {
      const parsed = JSON.parse(data) as JsonRecord
      content += extractSsePayloadText(provider, parsed)
    } catch {
      // Ignore malformed SSE payloads.
    }
  }

  return content
}

export function buildStreamWarningMessage(
  provider: Provider,
  warning: string,
): string {
  const messageText = `\n\n${warning}`

  switch (provider) {
    case "anthropic":
      return [
        "event: content_block_delta",
        `data: ${JSON.stringify({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: messageText },
        })}`,
        "",
      ].join("\n")
    case "google":
      return `data: ${JSON.stringify({
        candidates: [{
          content: {
            role: "model",
            parts: [{ text: messageText }],
          },
        }],
      })}\n\n`
    case "openai":
    default:
      return `data: ${JSON.stringify({
        choices: [{
          delta: { content: messageText },
          finish_reason: null,
        }],
      })}\n\n`
  }
}

export function buildStreamViolationEvent(
  warning: string,
  mode: "moderate" | "strict",
): string {
  return [
    "event: rulebound.violation",
    `data: ${JSON.stringify({
      type: "rulebound_violation",
      mode,
      message: "Rulebound: Code violations detected. Provider stream terminated.",
      warning,
    })}`,
    "",
  ].join("\n")
}

export function getStreamTerminator(provider: Provider): string {
  switch (provider) {
    case "openai":
      return "data: [DONE]\n\n"
    default:
      return ""
  }
}

function extractSsePayloadText(provider: Provider, payload: JsonRecord): string {
  switch (provider) {
    case "anthropic":
      return String(
        (payload.delta as { text?: string } | undefined)?.text
        ?? (payload.content_block as { text?: string } | undefined)?.text
        ?? "",
      )
    case "google":
      return readGoogleCandidateText(payload)
    case "openai":
    default: {
      const choices = payload.choices as Array<{ delta?: { content?: string } }> | undefined
      return String(
        choices?.[0]?.delta?.content
        ?? (payload.delta as { text?: string } | undefined)?.text
        ?? "",
      )
    }
  }
}

function readGoogleCandidateText(body: JsonRecord): string {
  const candidates = body.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
  return candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    ?? ""
}
