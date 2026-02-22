import { BookOpen, Zap, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    number: "01",
    title: "Define Once",
    description:
      "Write your engineering rules once in a central hub. No more scattered .cursor/rules.md or CLAUDE.md files across every repo.",
    icon: BookOpen,
  },
  {
    number: "02",
    title: "Auto-Inject",
    description:
      "Rulebound automatically selects the right rules based on the task at hand and injects them into your AI agent's context.",
    icon: Zap,
  },
  {
    number: "03",
    title: "Validate",
    description:
      "Before code ships, Rulebound validates the AI's task plan against your rules. Catch violations before they hit your codebase.",
    icon: ShieldCheck,
  },
];

export function Problem() {
  return (
    <section className="bg-(--color-background) py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Problem</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Where is your 10x productivity gain hiding?
        </h2>
        <p className="mt-4 max-w-2xl text-(--color-text-secondary)">
          You bought AI coding tools to move faster. Instead, you spend hours
          babysitting agents that don&apos;t know your architecture, your naming
          conventions, or your security policies.
        </p>
        <p className="mt-3 font-mono font-semibold text-(--color-text-primary) underline decoration-2 underline-offset-4">
          Rulebound fixes this.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.number} className="relative overflow-hidden">
              <CardContent className="pt-6">
                <span className="font-mono text-4xl font-bold text-(--color-grid)">
                  {step.number}
                </span>
                <div className="mt-4 flex items-center gap-3">
                  <step.icon className="h-5 w-5 text-(--color-text-primary) shrink-0" />
                  <h3 className="font-mono text-lg font-semibold">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm text-(--color-text-secondary) leading-relaxed">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
