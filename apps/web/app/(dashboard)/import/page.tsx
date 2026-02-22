"use client"

import { useState } from "react"
import { Upload, FileText, Github, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "paste", label: "Paste Text", icon: FileText },
  { id: "upload", label: "Upload File", icon: Upload },
  { id: "github", label: "GitHub Repository", icon: Github },
] as const

type TabId = (typeof TABS)[number]["id"]

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<TabId>("paste")

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-sans text-xl font-semibold text-(--color-text-primary)">
          Import Rules
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          Import rules from existing configuration files
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 border border-(--color-border) rounded-md p-4 bg-(--color-surface)">
        <Info className="h-4 w-4 text-(--color-primary) shrink-0 mt-0.5" />
        <div className="text-sm text-(--color-text-secondary) space-y-1">
          <p className="font-medium text-(--color-text-primary)">Supported formats</p>
          <p>
            CLAUDE.md, AGENTS.md, .cursorrules, and plain text rule definitions.
            Rules will be parsed and converted into structured, enforceable entries.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-(--color-border)">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors duration-150 border-b-2 -mb-px",
              activeTab === id
                ? "border-(--color-primary) text-(--color-primary)"
                : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary)"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
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
                  placeholder="Paste your CLAUDE.md, .cursorrules, or rule definitions here..."
                  className="flex w-full rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) placeholder:text-(--color-muted) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-primary) transition-colors duration-200"
                />
              </div>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Import Rules
              </Button>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-(--color-border) rounded-md p-8 text-center hover:border-(--color-primary)/50 transition-colors duration-150 cursor-pointer">
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
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ position: "relative" }}
                />
              </div>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Import Rules
              </Button>
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
                <Input
                  id="repo-url"
                  placeholder="https://github.com/owner/repo"
                />
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
              <Button className="gap-2">
                <Github className="h-4 w-4" />
                Import Rules
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
