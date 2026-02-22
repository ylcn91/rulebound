"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

const CATEGORIES = [
  "architecture",
  "security",
  "style",
  "testing",
  "performance",
] as const

const SEVERITIES = ["error", "warning", "info"] as const

export default function NewRulePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const body = {
      title: formData.get("title") as string,
      content: formData.get("content") as string,
      category: formData.get("category") as string,
      severity: formData.get("severity") as string,
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
    <div className="max-w-2xl space-y-6">
      {/* Back link */}
      <Link
        href="/rules"
        className="inline-flex items-center gap-1.5 text-sm text-(--color-text-secondary) hover:text-(--color-text-primary) cursor-pointer transition-colors duration-150"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Rules
      </Link>

      <div>
        <h1 className="font-sans text-xl font-semibold text-(--color-text-primary)">
          Create Rule
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          Define a new enforcement rule for your AI coding agents
        </p>
      </div>

      <Card>
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
                placeholder="e.g. No hardcoded secrets in source code"
              />
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <label
                htmlFor="content"
                className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
              >
                Content
              </label>
              <textarea
                id="content"
                name="content"
                required
                rows={6}
                placeholder="Rule description in markdown..."
                className="flex w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) placeholder:text-(--color-muted) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-primary) transition-colors duration-200"
              />
            </div>

            {/* Category + Severity row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  className="flex h-10 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-primary) transition-colors duration-200"
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
                  className="flex h-10 w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-text-primary) cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-primary) transition-colors duration-200"
                >
                  {SEVERITIES.map((sev) => (
                    <option key={sev} value={sev}>
                      {sev.charAt(0).toUpperCase() + sev.slice(1)}
                    </option>
                  ))}
                </select>
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
              <p className="text-xs text-(--color-muted)">
                Separate tags with commas
              </p>
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
  )
}
