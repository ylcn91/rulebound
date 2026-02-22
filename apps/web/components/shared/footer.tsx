import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const navColumns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Docs", href: "/docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faq" },
      { label: "GitHub", href: "https://github.com/rulebound/rulebound" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-(--color-border) bg-(--color-surface)">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="font-mono text-lg font-bold text-(--color-text-primary)"
            >
              Rulebound
            </Link>
            <p className="mt-3 text-sm text-(--color-text-secondary) max-w-xs">
              Centralized rules for AI coding agents. Ship enterprise-ready
              code at 10x speed.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Badge variant="stamp">MIT License</Badge>
            </div>
          </div>

          {navColumns.map((column) => (
            <div key={column.title}>
              <p className="section-label mb-4">{column.title}</p>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="divider-dots mt-12 mb-8" role="separator" />

        <p className="text-xs text-(--color-muted)">
          &copy; {new Date().getFullYear()} Rulebound. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
