import { X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const without = [
  "CLAUDE.md and .cursorrules copy-pasted across repos",
  "Rules exist as tribal knowledge in Slack threads",
  "AI agents pass code review by luck, not compliance",
  "New hires spend weeks learning unwritten standards",
  "Violations caught in PR review, days after writing",
  "No visibility into which rules are followed or ignored",
];

const withRulebound = [
  "One rule hub, inherited per project and stack",
  "AST + semantic analysis catches violations at write-time",
  "Enforcement modes from advisory to strict blocking",
  "Rules are code — versioned, reviewed, auditable",
  "Real-time IDE diagnostics via LSP",
  "Compliance scores and audit trail per project",
];

export function Comparison() {
  return (
    <section id="comparison" className="bg-(--color-background) py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Comparison</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          From Scattered Docs to Structural Enforcement
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Card className="border-2 border-dashed">
            <CardContent className="pt-6">
              <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-(--color-muted) line-through decoration-2">
                Without Rulebound
              </h3>
              <ul className="mt-6 space-y-4">
                {without.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <X className="h-4 w-4 shrink-0 text-(--color-muted) mt-0.5" />
                    <span className="text-(--color-text-secondary)">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-(--color-text-primary)">
            <CardContent className="pt-6">
              <div className="stamp text-(--color-text-primary) text-xs mb-4 inline-block">Rulebound</div>
              <ul className="mt-2 space-y-4">
                {withRulebound.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-(--color-text-primary) mt-0.5" />
                    <span className="text-(--color-text-primary) font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
