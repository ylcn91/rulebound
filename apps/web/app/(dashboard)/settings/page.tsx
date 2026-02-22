import { Key, Trash2, Plus, User } from "lucide-react"
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
        <h1 className="font-sans text-xl font-semibold text-(--color-text-primary)">
          Settings
        </h1>
        <p className="text-sm text-(--color-text-secondary) mt-1">
          Manage your account and API access
        </p>
      </div>

      {/* Profile section */}
      <section className="space-y-4">
        <h2 className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest">
          Profile
        </h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-(--color-grid) border border-(--color-border) flex items-center justify-center">
                <User className="h-6 w-6 text-(--color-muted)" />
              </div>
              <div>
                <p className="font-medium text-(--color-text-primary)">Jane Developer</p>
                <p className="text-sm text-(--color-text-secondary)">jane@example.com</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                >
                  Name
                </label>
                <Input id="name" defaultValue="Jane Developer" readOnly />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="font-mono text-xs font-semibold text-(--color-muted) uppercase tracking-widest"
                >
                  Email
                </label>
                <Input id="email" defaultValue="jane@example.com" readOnly />
              </div>
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
        <Card>
          <div className="divide-y divide-(--color-border)">
            {MOCK_TOKENS.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-(--color-muted) shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-(--color-text-primary)">
                      {token.name}
                    </p>
                    <p className="text-xs text-(--color-muted)">
                      Created {token.createdAt} &middot; Last used{" "}
                      {token.lastUsedAt}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-(--color-accent) hover:text-(--color-accent) hover:bg-(--color-accent)/10"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Danger zone */}
      <section className="space-y-4">
        <h2 className="font-mono text-xs font-semibold text-(--color-accent) uppercase tracking-widest">
          Danger Zone
        </h2>
        <Card className="border-(--color-accent)/30">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-(--color-text-primary)">
                Delete Account
              </p>
              <p className="text-xs text-(--color-text-secondary) mt-0.5">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-(--color-accent)/30 text-(--color-accent) hover:bg-(--color-accent)/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
