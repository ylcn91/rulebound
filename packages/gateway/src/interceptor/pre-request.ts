import type { Rule } from "@rulebound/engine"

export function buildRuleInjectionText(rules: Rule[]): string {
  if (rules.length === 0) return ""

  const lines = [
    "<rulebound_rules>",
    "The following project rules MUST be followed when writing code:",
    "",
  ]

  for (const rule of rules) {
    const severityTag = rule.severity === "error" ? "[MUST]" : rule.severity === "warning" ? "[SHOULD]" : "[MAY]"
    lines.push(`${severityTag} ${rule.title}`)
    const contentLines = rule.content.split("\n").filter((l) => l.trim())
    for (const cl of contentLines.slice(0, 5)) {
      lines.push(`  ${cl}`)
    }
    lines.push("")
  }

  lines.push("</rulebound_rules>")
  return lines.join("\n")
}

interface OpenAIMessage {
  role: string
  content: string | Array<{ type: string; text?: string }>
}

interface OpenAIRequest {
  messages?: OpenAIMessage[]
  model?: string
  [key: string]: unknown
}

interface AnthropicRequest {
  system?: string | Array<{ type: string; text: string }>
  messages?: Array<{ role: string; content: string | unknown[] }>
  model?: string
  [key: string]: unknown
}

export function injectRulesOpenAI(body: OpenAIRequest, ruleText: string): OpenAIRequest {
  if (!body.messages || ruleText.length === 0) return body

  const messages = [...body.messages]
  const systemIdx = messages.findIndex((m) => m.role === "system")

  if (systemIdx >= 0) {
    const existing = messages[systemIdx]
    const currentContent = typeof existing.content === "string"
      ? existing.content
      : existing.content.map((c) => c.text ?? "").join("\n")

    messages[systemIdx] = {
      ...existing,
      content: `${currentContent}\n\n${ruleText}`,
    }
  } else {
    messages.unshift({ role: "system", content: ruleText })
  }

  return { ...body, messages }
}

export function injectRulesAnthropic(body: AnthropicRequest, ruleText: string): AnthropicRequest {
  if (ruleText.length === 0) return body

  if (typeof body.system === "string") {
    return { ...body, system: `${body.system}\n\n${ruleText}` }
  }

  if (Array.isArray(body.system)) {
    return {
      ...body,
      system: [...body.system, { type: "text", text: ruleText }],
    }
  }

  return { ...body, system: ruleText }
}
