import { X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const without = [
  ".cursor/rules.md scattered in every repo",
  "CLAUDE.md buried in project roots",
  "Developers copy-paste rules between projects",
  "New team members miss critical standards",
  "AI agents ignore half your conventions",
  "Hours lost fixing AI-generated code",
];

const withRulebound = [
  "One central hub for all rules",
  "Rules auto-selected by task context",
  "Always current, always consistent",
  "Instant onboarding for new members",
  "AI follows your standards every time",
  "Ship at 10x with full confidence",
];

export function Comparison() {
  return (
    <section className="bg-(--color-background) py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Comparison</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Stop Managing Rules in Scattered Files
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Card className="border-[--color-accent]/30">
            <CardContent className="pt-6">
              <h3 className="font-mono text-lg font-semibold text-(--color-accent)">
                Without Rulebound
              </h3>
              <ul className="mt-6 space-y-4">
                {without.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <X className="h-4 w-4 shrink-0 text-(--color-accent) mt-0.5" />
                    <span className="text-(--color-text-secondary)">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-[--color-success]/30">
            <CardContent className="pt-6">
              <h3 className="font-mono text-lg font-semibold text-(--color-success)">
                With Rulebound
              </h3>
              <ul className="mt-6 space-y-4">
                {withRulebound.map((item) => (
                  <li key={item} className="flex gap-3 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-(--color-success) mt-0.5" />
                    <span className="text-(--color-text-secondary)">{item}</span>
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
