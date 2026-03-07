import { NextResponse } from "next/server"

interface ParsedRule {
  title: string
  content: string
  category: string
  severity: string
  modality: string
  tags: string[]
  slug: string
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  security: ["secret", "auth", "token", "password", "xss", "injection", "csrf", "encrypt", "credential"],
  architecture: ["pattern", "dependency", "inject", "layer", "module", "structure", "service"],
  style: ["naming", "format", "lint", "convention", "import", "comment", "indentation"],
  testing: ["test", "spec", "coverage", "mock", "assert", "expect"],
  performance: ["cache", "lazy", "memo", "debounce", "optimize", "performance"],
  accessibility: ["a11y", "wcag", "aria", "keyboard", "focus", "contrast"],
  infra: ["docker", "kubernetes", "ci", "cd", "deploy", "pipeline"],
  workflow: ["git", "branch", "commit", "pr", "review", "merge"],
}

const MUST_PATTERNS = [/\bMUST\b/, /\bNEVER\b/, /\bALWAYS\b/, /\bREQUIRED\b/]

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
}

function detectCategory(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase()
  let best = "general"
  let bestScore = 0
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter((kw) => text.includes(kw)).length
    if (score > bestScore) { bestScore = score; best = cat }
  }
  return best
}

function detectModality(content: string): string {
  if (MUST_PATTERNS.some((p) => p.test(content))) return "must"
  if (/\bSHOULD\b/.test(content)) return "should"
  return "may"
}

function parseMarkdown(markdown: string): ParsedRule[] {
  const cleaned = markdown.replace(/<\/?coding_guidelines>/gi, "").trim()
  const lines = cleaned.split("\n")
  const sections: Array<{ title: string; lines: string[] }> = []
  let current: { title: string; lines: string[] } | null = null

  for (const line of lines) {
    const match = line.match(/^#{2,3}\s+(.+)$/)
    if (match) {
      if (current && current.lines.some((l) => l.trim())) {
        sections.push(current)
      }
      current = { title: match[1].trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current && current.lines.some((l) => l.trim())) {
    sections.push(current)
  }

  return sections
    .filter((s) => s.lines.filter((l) => l.trim()).length >= 1)
    .map((s) => {
      const content = s.lines.join("\n").trim()
      const modality = detectModality(content)
      const category = detectCategory(s.title, content)
      return {
        title: s.title,
        content,
        category,
        severity: modality === "must" ? "error" : modality === "should" ? "warning" : "info",
        modality,
        tags: [],
        slug: slugify(s.title),
      }
    })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { content, source } = body as { content?: string; source?: string }

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 })
    }

    const rules = parseMarkdown(content)

    return NextResponse.json({
      data: {
        rules,
        source: source ?? "paste",
        count: rules.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to parse content" },
      { status: 500 }
    )
  }
}
