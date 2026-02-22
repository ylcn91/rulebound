"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  FolderKanban,
  Import,
  Settings,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/rules", label: "Rules", icon: BookOpen },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/import", label: "Import", icon: Import },
  { href: "/settings", label: "Settings", icon: Settings },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden cursor-pointer p-2 rounded-md bg-(--color-surface) border border-(--color-border) text-(--color-text-primary)"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 bg-(--color-surface) border-r border-(--color-border) flex flex-col transition-transform duration-200",
          "md:translate-x-0 md:static md:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-(--color-border)">
          <Link
            href="/rules"
            className="font-mono text-base font-bold tracking-tight text-(--color-text-primary) cursor-pointer"
          >
            rulebound
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden cursor-pointer p-1 text-(--color-text-secondary) hover:text-(--color-text-primary)"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-1" aria-label="Dashboard navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150",
                  active
                    ? "bg-(--color-primary)/10 text-(--color-primary)"
                    : "text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-grid)"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-(--color-border)">
          <p className="font-mono text-xs text-(--color-muted) tracking-wide uppercase">
            v0.1.0
          </p>
        </div>
      </aside>
    </>
  )
}
