"use client"

import { useState } from "react"
import { Upload, FileText, Github, Info, CheckCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "paste", label: "Paste Text", icon: FileText },
  { id: "upload", label: "Upload File", icon: Upload },
  { id: "github", label: "GitHub Repository", icon: Github },
] as const

type TabId = (typeof TABS)[number]["id"]

interface ParsedRule {
  title: string
  content: string
  category: string
  severity: string
  modality: string
  slug: string
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<TabId>("paste")
  const [pasteContent, setPasteContent] = useState("")
  const [parsedRules, setParsedRules] = useState<ParsedRule[]>([])
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleParse(content: string) {
    if (!content.trim()) return
    setParsing(true)
    setError(null)
    setParsedRules([])

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, source: activeTab }),
      })

      if (!res.ok) {
        setError("Failed to parse content")
        return
      }

      const data = await res.json()
      setParsedRules(data.data?.rules ?? [])
    } catch {
      setError("Failed to parse content")
    } finally {
      setParsing(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    setPasteContent(text)
    handleParse(text)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-sans text-xl font-semibold text-(--color-text-primary)">
          Import Rules
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          Import rules from existing configuration files
        </p>
      </div>

      <div className="flex items-start gap-3 border border-(--color-border) rounded-md p-4 bg-(--color-surface)">
        <Info className="h-4 w-4 text-(--color-text-primary) shrink-0 mt-0.5" />
        <div className="text-sm text-(--color-text-secondary) space-y-1">
          <p className="font-medium text-(--color-text-primary)">Supported formats</p>
          <p>
            CLAUDE.md, AGENTS.md, .cursorrules, and plain text rule definitions.
            Rules will be parsed and converted into structured, enforceable entries.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-(--color-border)">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors duration-150 border-b-2 -mb-px",
              activeTab === id
                ? "border-(--color-text-primary) text-(--color-text-primary) font-bold"
                : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {activeTab === "paste" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="paste-content"
                  className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                >
                  Rule Content
                </label>
                <textarea
                  id="paste-content"
                  rows={10}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder="Paste your CLAUDE.md, .cursorrules, or rule definitions here..."
                  className="flex w-full border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) placeholder:text-(--color-muted) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
                />
              </div>
              <Button
                className="gap-2 cursor-pointer"
                onClick={() => handleParse(pasteContent)}
                disabled={parsing || !pasteContent.trim()}
              >
                <Upload className="h-4 w-4" />
                {parsing ? "Parsing..." : "Parse Rules"}
              </Button>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-(--color-border) rounded-md p-8 text-center hover:border-(--color-text-primary)/50 transition-colors duration-150 cursor-pointer relative">
                <Upload className="h-8 w-8 text-(--color-muted) mx-auto mb-3" />
                <p className="text-sm text-(--color-text-secondary)">
                  Drag and drop your file here, or click to browse
                </p>
                <p className="text-xs text-(--color-muted) mt-1">
                  Supports .md, .txt, .cursorrules
                </p>
                <input
                  type="file"
                  accept=".md,.txt,.cursorrules"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === "github" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="repo-url"
                  className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                >
                  Repository URL
                </label>
                <Input id="repo-url" placeholder="https://github.com/owner/repo" />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="branch"
                  className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                >
                  Branch
                </label>
                <Input id="branch" placeholder="main" defaultValue="main" />
              </div>
              <Button className="gap-2 cursor-pointer">
                <Github className="h-4 w-4" />
                Import Rules
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-3 border border-red-300 bg-red-50 dark:bg-red-950/20 rounded-md">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {parsedRules.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
                Parsed Rules ({parsedRules.length})
              </h2>
            </div>
            <div className="space-y-3">
              {parsedRules.map((rule) => (
                <div
                  key={rule.slug}
                  className="border border-(--color-border) rounded-md p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-(--color-text-primary)">
                      {rule.title}
                    </h3>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {rule.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", {
                          "border-red-300 text-red-700 dark:text-red-300": rule.severity === "error",
                          "border-yellow-300 text-yellow-700 dark:text-yellow-300": rule.severity === "warning",
                          "border-blue-300 text-blue-700 dark:text-blue-300": rule.severity === "info",
                        })}
                      >
                        {rule.modality}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-(--color-text-secondary) mt-1 line-clamp-2">
                    {rule.content.slice(0, 150)}
                    {rule.content.length > 150 ? "..." : ""}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
