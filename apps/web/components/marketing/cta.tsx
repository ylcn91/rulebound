import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="bg-(--color-background) py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Stay on track. Start contributing.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-(--color-text-secondary)">
          Give your AI coding agents the context they need. Define your rules
          once and let every agent follow them &mdash; automatically.
        </p>

        <div className="mt-8">
          <a
            href="https://github.com/ylcn91/rulebound"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 font-mono text-sm font-semibold uppercase tracking-wider bg-(--color-text-primary) text-(--color-background) hover:opacity-90 transition-opacity duration-200 rounded-none border-2 border-(--color-text-primary)"
          >
            View on GitHub
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <p className="mt-4 font-mono text-xs text-(--color-muted) uppercase tracking-widest">
          MIT License &middot; Claude Code &middot; Copilot &middot; Cursor
        </p>
      </div>
    </section>
  );
}
