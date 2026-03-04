"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { navigation, type NavSection } from "@/content/docs/registry"

function SidebarSection({ section }: { readonly section: NavSection }) {
  const pathname = usePathname()
  const isActive = section.items.some(
    (item) => pathname === `/docs/${item.slug}`
  )
  const [open, setOpen] = useState(isActive)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 font-mono text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text-primary) transition-colors duration-150 cursor-pointer"
        aria-expanded={open}
      >
        {section.title}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 pb-2">
          {section.items.map((item) => {
            const href = `/docs/${item.slug}`
            const active = pathname === href
            return (
              <li key={item.slug}>
                <Link
                  href={href}
                  className={cn(
                    "block px-3 py-1.5 ml-2 text-sm border-l-2 transition-colors duration-150 cursor-pointer",
                    active
                      ? "border-(--color-text-primary) text-(--color-text-primary) font-medium bg-(--color-text-primary)/5"
                      : "border-transparent text-(--color-text-secondary) hover:text-(--color-text-primary) hover:border-(--color-border)"
                  )}
                >
                  {item.title}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function DocsSidebar() {
  const [open, setOpen] = useState(false)

  const sidebarContent = (
    <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1" aria-label="Documentation navigation">
      {navigation.map((section) => (
        <SidebarSection key={section.title} section={section} />
      ))}
    </nav>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-20 left-3 z-50 lg:hidden cursor-pointer p-2 bg-(--color-surface) border-2 border-(--color-border) text-(--color-text-primary)"
        aria-label="Open documentation navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-70 bg-(--color-surface) border-r-2 border-(--color-border) flex flex-col transition-transform duration-200",
          "lg:translate-x-0 lg:static lg:z-auto lg:pt-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile close */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-(--color-border) lg:hidden">
          <span className="font-mono text-sm font-bold text-(--color-text-primary) uppercase tracking-widest">
            Docs
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer p-1 text-(--color-text-secondary) hover:text-(--color-text-primary)"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sidebarContent}
      </aside>
    </>
  )
}
