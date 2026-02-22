import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="bg-(--color-background) py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Stay on track. Start contributing.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-(--color-text-secondary)">
          Give your AI coding agents the context they need. Define your rules
          once and let every agent follow them — automatically.
        </p>

        <div className="mt-8">
          <Button size="lg" className="bg-(--color-success) hover:bg-[#15803d] gap-2" asChild>
            <a
              href="https://github.com/rulebound/rulebound"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>

        <p className="mt-4 text-sm text-(--color-muted)">
          Open source under MIT license. Works with Claude Code, GitHub Copilot &amp; Cursor.
        </p>
      </div>
    </section>
  );
}
