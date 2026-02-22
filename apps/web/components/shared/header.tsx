import Link from "next/link";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MobileMenu } from "@/components/shared/mobile-menu";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Docs", href: "https://github.com/ylcn91/rulebound#readme" },
  { label: "GitHub", href: "https://github.com/ylcn91/rulebound" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-(--color-text-primary)/10 bg-(--color-background)/95 backdrop-blur-sm supports-[backdrop-filter]:bg-(--color-background)/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-mono text-lg font-bold tracking-tight text-(--color-text-primary) uppercase"
        >
          <span className="inline-block border-2 border-current px-2 py-0.5 -rotate-1">Rulebound</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-mono text-xs uppercase tracking-widest text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors duration-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <MobileMenu links={navLinks} />
        </div>
      </div>
    </header>
  );
}
