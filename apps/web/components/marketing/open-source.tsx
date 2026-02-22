import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          Rulebound is free forever for individuals. The core platform is
          open-source under the MIT license. Inspect the code, contribute, and
          make it your own.
        </p>

        <div className="mt-6">
          <Badge variant="stamp">Open Source</Badge>
        </div>

        <div className="mt-8">
          <Button variant="outline" size="lg" className="gap-2" asChild>
            <a
              href="https://github.com/rulebound/rulebound"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
