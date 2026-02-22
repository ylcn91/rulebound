import { Database, Crosshair, ShieldCheck, Blocks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    title: "Centralized Rule Hub",
    description:
      "Store all your engineering rules in one place. Organize by domain, team, or project. Version-controlled and always in sync.",
    icon: Database,
  },
  {
    title: "Dynamic Context Selection",
    description:
      "Rulebound analyzes each task and selects only the relevant rules. No context window bloat — just the rules that matter.",
    icon: Crosshair,
  },
  {
    title: "Task Plan Validation",
    description:
      "Before code ships, validate the AI agent's plan against your rules. Catch architecture violations, missed tests, and security gaps.",
    icon: ShieldCheck,
  },
  {
    title: "Multi-Agent Integration",
    description:
      "Works with Claude Code, Cursor, GitHub Copilot, and more. One set of rules, every agent, every project.",
    icon: Blocks,
  },
];

export function Features() {
  return (
    <section id="features" className="bg-dot-grid py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Features</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Everything You Need to Ship With Confidence
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-(--color-primary)/10">
                  <feature.icon className="h-5 w-5 text-(--color-primary)" />
                </div>
                <h3 className="mt-4 font-mono text-lg font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-(--color-text-secondary) leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
