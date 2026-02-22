import { User } from "lucide-react"

export function TopBar() {
  return (
    <header className="h-14 border-b border-(--color-border) bg-(--color-surface) flex items-center justify-between px-6">
      <div className="font-mono text-xs text-(--color-muted) tracking-widest uppercase">
        Dashboard
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-(--color-text-secondary) hidden sm:block">
          My Organization
        </span>
        <div className="h-8 w-8 rounded-full bg-(--color-grid) border border-(--color-border) flex items-center justify-center">
          <User className="h-4 w-4 text-(--color-muted)" />
        </div>
      </div>
    </header>
  )
}
