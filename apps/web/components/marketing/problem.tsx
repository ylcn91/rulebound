import { BookOpen, Zap, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    number: "01",
    title: "Codify",
    description:
      "Turn your engineering standards into structured, versioned rules. Markdown files, git-tracked, inherited across projects.",
    icon: BookOpen,
  },
  {
    number: "02",
    title: "Intercept",
    description:
      "Rulebound analyzes code at the AST level and intercepts LLM responses through a gateway proxy — before violations reach your repo.",
    icon: Zap,
  },
  {
    number: "03",
    title: "Enforce",
    description:
      "Pre-commit hooks, CI checks, and real-time IDE diagnostics. Choose advisory, moderate, or strict — block or warn, your call.",
    icon: ShieldCheck,
  },
];

export function Problem() {
  return (
    <section className="bg-(--color-background) py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Problem</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Fast Code Without Guard Rails is Just Fast Debt.
        </h2>
        <p className="mt-4 max-w-2xl text-(--color-text-secondary)">
          Your AI agents don&apos;t read your architecture docs, ignore your
          naming conventions, and skip your security policies. Every PR becomes
          a review marathon.
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
