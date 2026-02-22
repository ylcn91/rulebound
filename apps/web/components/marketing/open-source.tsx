import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function OpenSource() {
  return (
    <section id="open-source" className="bg-(--color-background) py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="section-label">Open Source</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Built in the open.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-(--color-text-secondary)">
          Rulebound is free forever. The entire platform is open-source under
          the MIT license. Inspect the code, contribute, and make it your own.
        </p>

        <div className="mt-6">
          <Badge variant="stamp">MIT License</Badge>
        </div>

        <div className="mt-8">
          <a
            href="https://github.com/ylcn91/rulebound"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 font-mono text-sm font-semibold uppercase tracking-wider bg-transparent text-(--color-text-primary) border-2 border-(--color-text-primary) hover:bg-(--color-text-primary)/5 transition-colors duration-200 rounded-none"
          >
            View on GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
