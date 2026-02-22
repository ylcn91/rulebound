import { Key, Trash2, Plus, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

const MOCK_TOKENS = [
  {
    id: "1",
    name: "CI Pipeline",
    createdAt: "2026-01-15",
    lastUsedAt: "2026-02-22",
  },
  {
    id: "2",
    name: "Local Development",
    createdAt: "2026-02-01",
    lastUsedAt: "2026-02-20",
  },
] as const

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
          Settings
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          Configure your workspace and CLI access
        </p>
      </div>

      {/* CLI Setup section */}
      <section className="space-y-4">
        <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
          CLI Setup
        </h2>
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="terminal overflow-hidden">
              <div className="terminal-header">
                <span className="terminal-dot bg-[#ff5f57]" />
                <span className="terminal-dot bg-[#febc2e]" />
                <span className="terminal-dot bg-[#28c840]" />
                <span className="ml-2 text-xs text-[#5c6773]">setup</span>
              </div>
              <pre className="p-4 text-xs leading-relaxed text-[#e6e1cf]">
{`$ npm install -g @rulebound/cli
$ rulebound init
$ rulebound find-rules --task "your task"`}</pre>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* API Tokens section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
            API Tokens
          </h2>
          <Button size="sm" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Generate Token
          </Button>
        </div>
        <Card className="border-2">
          <div className="divide-y divide-(--color-border)">
            {MOCK_TOKENS.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-(--color-muted) shrink-0" />
                  <div>
                    <p className="font-mono text-sm font-medium text-(--color-text-primary)">
                      {token.name}
                    </p>
                    <p className="font-mono text-xs text-(--color-muted)">
                      Created {token.createdAt} / Last used{" "}
                      {token.lastUsedAt}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="danger">
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Workspace section */}
      <section className="space-y-4">
        <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
          Workspace
        </h2>
        <Card className="border-2">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="workspace-name"
                className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
              >
                Name
              </label>
              <Input id="workspace-name" defaultValue="My Workspace" />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="default-severity"
                className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
              >
                Default Severity
              </label>
              <select
                id="default-severity"
                className="flex h-10 w-full border-2 border-(--color-border) bg-(--color-surface) px-3 py-2 font-mono text-sm text-(--color-text-primary) cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary) transition-colors duration-200"
              >
                <option value="error">Error</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            <Button size="sm">Save Changes</Button>
          </CardContent>
        </Card>
      </section>

      {/* Danger zone */}
      <section className="space-y-4">
        <h2 className="font-mono text-xs font-semibold text-(--color-accent) uppercase tracking-widest">
          Danger Zone
        </h2>
        <Card className="border-2 border-(--color-accent)/30">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="font-mono text-sm font-bold text-(--color-text-primary)">
                Delete Workspace
              </p>
              <p className="text-xs text-(--color-text-secondary) mt-0.5">
                Permanently delete this workspace and all rules
              </p>
            </div>
            <Button size="sm" variant="danger" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
