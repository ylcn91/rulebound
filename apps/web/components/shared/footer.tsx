import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Comparison", href: "/#comparison" },
  { label: "Open Source", href: "/#open-source" },
  { label: "GitHub", href: "https://github.com/rulebound/rulebound" },
];

export function Footer() {
  return (
    <footer className="border-t border-(--color-border) bg-(--color-surface)">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
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

          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {navLinks.map((link) => (
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
          </nav>
        </div>

        <div className="divider-dots mt-12 mb-8" role="separator" />

        <p className="text-xs text-(--color-muted)">
          &copy; {new Date().getFullYear()} Rulebound. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
