"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const CATEGORIES = [
  "architecture",
  "security",
  "style",
  "testing",
  "performance",
  "documentation",
  "accessibility",
] as const

const SEVERITIES = ["error", "warning", "info"] as const
const MODALITIES = ["must", "should", "may"] as const

function QualityMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
          {label}
        </span>
        <span className="font-mono text-xs font-bold text-(--color-text-primary)">
          {value}/5
        </span>
      </div>
      <div className="h-1.5 bg-(--color-grid) overflow-hidden">
        <div
          className="h-full bg-(--color-text-primary) transition-all duration-300"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
    </div>
  )
}

export default function NewRulePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [modality, setModality] = useState<string>("must")

  // Simple quality scoring based on content
  const atomicity = content.split("\n").filter(l => l.startsWith("- ")).length <= 3 && content.length > 0 ? 4 : content.length > 0 ? 2 : 0
  const completeness = (
    (title.length > 10 ? 1 : 0) +
    (content.includes("- ") ? 1 : 0) +
    (content.length > 50 ? 1 : 0) +
    (modality ? 1 : 0) +
    (content.includes("```") ? 1 : 0)
  )
  const clarity = (
    (title.length > 0 && !title.includes("etc") ? 1 : 0) +
    (content.includes("must") || content.includes("should") || content.includes("always") || content.includes("never") ? 2 : 0) +
    (content.length > 20 && content.length < 500 ? 2 : 0)
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const body = {
      title: formData.get("title") as string,
      content: formData.get("content") as string,
      category: formData.get("category") as string,
      severity: formData.get("severity") as string,
      modality: formData.get("modality") as string,
      codeSnippet: formData.get("codeSnippet") as string,
      tags: (formData.get("tags") as string)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    }

    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.push("/rules")
      }
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href="/rules"
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-(--color-text-secondary) hover:text-(--color-text-primary) cursor-pointer transition-colors duration-150"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Rules
      </Link>

      <div>
        <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
          Create Rule
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          Define a new enforcement rule for your AI coding agents
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2">
          <Card className="border-2">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Title */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="title"
                    className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                  >
                    Title
                  </label>
                  <Input
                    id="title"
                    name="title"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. No hardcoded secrets in source code"
                  />
                </div>

                {/* Content */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="content"
                    className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                  >
                    Rule Definition
                  </label>
                  <textarea
                    id="content"
                    name="content"
                    required
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={"- Use Zod schemas for every API endpoint\n- Never trust client-side validation alone\n- Sanitize HTML output to prevent XSS"}
                    className="flex w-full border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) placeholder:text-(--color-muted) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
                  />
                </div>

                {/* Category + Severity + Modality row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="category"
                      className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                    >
                      Category
                    </label>
                    <select
                      id="category"
                      name="category"
                      required
                      className="flex h-10 w-full border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="severity"
                      className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                    >
                      Severity
                    </label>
                    <select
                      id="severity"
                      name="severity"
                      required
                      className="flex h-10 w-full border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
                    >
                      {SEVERITIES.map((sev) => (
                        <option key={sev} value={sev}>
                          {sev.charAt(0).toUpperCase() + sev.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="modality"
                      className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                    >
                      Modality
                    </label>
                    <select
                      id="modality"
                      name="modality"
                      required
                      value={modality}
                      onChange={(e) => setModality(e.target.value)}
                      className="flex h-10 w-full border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
                    >
                      {MODALITIES.map((mod) => (
                        <option key={mod} value={mod}>
                          {mod.toUpperCase()} — {mod === "must" ? "mandatory" : mod === "should" ? "recommended" : "optional"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Code snippet */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="codeSnippet"
                    className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                  >
                    Code Example (optional)
                  </label>
                  <div className="terminal overflow-hidden">
                    <div className="terminal-header">
                      <span className="terminal-dot bg-[#ff5f57]" />
                      <span className="terminal-dot bg-[#febc2e]" />
                      <span className="terminal-dot bg-[#28c840]" />
                      <span className="ml-2 text-xs text-[#5c6773]">example</span>
                    </div>
                    <textarea
                      id="codeSnippet"
                      name="codeSnippet"
                      rows={4}
                      placeholder={"// Good example\nconst secret = process.env.API_KEY;\n\n// Bad example\nconst secret = 'sk-1234...';"}
                      className="w-full bg-[#0f1419] text-[#e6e1cf] font-mono text-xs p-4 focus:outline-none resize-y placeholder:text-[#5c6773]"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="tags"
                    className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                  >
                    Tags
                  </label>
                  <Input
                    id="tags"
                    name="tags"
                    placeholder="comma-separated, e.g. secrets, env, ci"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Rule"}
                  </Button>
                  <Button type="button" variant="ghost" asChild>
                    <Link href="/rules">Cancel</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Quality sidebar */}
        <div className="space-y-4">
          <Card className="border-2">
            <CardContent className="pt-6 space-y-5">
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-(--color-text-primary) mb-4">
                  Rule Quality
                </h3>
                <div className="space-y-4">
                  <QualityMeter label="Atomicity" value={atomicity} />
                  <QualityMeter label="Completeness" value={completeness} />
                  <QualityMeter label="Clarity" value={clarity} />
                </div>
              </div>

              <div className="divider-dots" />

              <div className="space-y-2">
                <h4 className="font-mono text-xs font-bold uppercase tracking-widest text-(--color-muted)">
                  Tips
                </h4>
                <div className="space-y-2 text-xs text-(--color-text-secondary)">
                  <div className="flex gap-2">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-(--color-muted)" />
                    <p><strong>Atomicity:</strong> One rule, one action. Keep bullet points under 3.</p>
                  </div>
                  <div className="flex gap-2">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-(--color-muted)" />
                    <p><strong>Completeness:</strong> Include verb + object + conditions. Add a code example.</p>
                  </div>
                  <div className="flex gap-2">
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-(--color-muted)" />
                    <p><strong>Clarity:</strong> Use active voice. Prefer &quot;must&quot; or &quot;never&quot; over vague words.</p>
                  </div>
                </div>
              </div>

              <div className="divider-dots" />

              <div>
                <h4 className="font-mono text-xs font-bold uppercase tracking-widest text-(--color-muted) mb-2">
                  Modality
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">MUST</Badge>
                    <span className="text-xs text-(--color-text-secondary)">Mandatory. Fail on violation.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">SHOULD</Badge>
                    <span className="text-xs text-(--color-text-secondary)">Recommended. Warn on violation.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">MAY</Badge>
                    <span className="text-xs text-(--color-text-secondary)">Optional. Info only.</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
