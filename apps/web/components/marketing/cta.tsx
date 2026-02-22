import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="bg-(--color-background) py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Stay on track. Start for free.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-(--color-text-secondary)">
          Give your AI coding agents the context they need. Define your rules
          once and let every agent follow them — automatically.
        </p>

        <div className="mt-8">
          <Button size="lg" className="bg-(--color-success) hover:bg-[#15803d] gap-2">
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-4 text-sm text-(--color-muted)">
          Works with Claude Code, GitHub Copilot &amp; Cursor. No credit card
          required.
        </p>
      </div>
    </section>
  );
}
