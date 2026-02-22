import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MobileMenu } from "@/components/shared/mobile-menu";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Docs", href: "https://github.com/rulebound/rulebound#readme" },
  { label: "GitHub", href: "https://github.com/rulebound/rulebound" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-(--color-border) bg-(--color-background)/95 backdrop-blur-sm supports-[backdrop-filter]:bg-(--color-background)/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-mono text-lg font-bold text-(--color-text-primary)"
        >
          Rulebound
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors duration-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">Log in</Link>
          </Button>
          <MobileMenu links={navLinks} />
        </div>
      </div>
    </header>
  );
}
