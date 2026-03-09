import {
  TreePine,
  Radar,
  Crosshair,
  Plug,
  Shield,
  Database,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const highlightedFeatures = [
  {
    title: "AST Code Analysis",
    description:
      "Tree-sitter WASM parser detects structural anti-patterns across 10 languages. Built-in structural queries — no regex, real AST matching.",
    icon: TreePine,
  },
  {
    title: "LLM Gateway",
    description:
      "Transparent proxy between AI tools and LLM APIs. Injects rules into prompts, scans responses for violations in real-time.",
    icon: Radar,
  },
  {
    title: "Semantic Rule Matching",
    description:
      "Rulebound analyzes each task and selects only the relevant rules. No context window bloat — just the rules that matter.",
    icon: Crosshair,
  },
  {
    title: "MCP Server",
    description:
      "AI agents query and validate against rules in real-time via Model Context Protocol. Auto-detects project stack and filters rules.",
    icon: Plug,
  },
  {
    title: "Enforcement Modes",
    description:
      "Choose advisory, moderate, or strict enforcement. Control when violations block commits and CI pipelines with configurable score thresholds.",
    icon: Shield,
  },
  {
    title: "Rule Registry",
    description:
      "Store all your engineering rules in one place. Organize by domain, team, or project. Version-controlled and always in sync.",
    icon: Database,
  },
];

const moreFeatures = [
  "Generate Agent Configs",
  "Plan-Before-Code Gating",
  "Diff Validation",
  "Behavior-Preserving Bugfix Workflow",
  "Compliance Score",
  "Pre-Commit Hook",
  "Quality Attributes",
  "Multi-Agent Support",
  "Rule Versioning",
  "Rule Inheritance",
  "CLI-First Workflow",
  "CI/CD Pipeline",
  "Multi-Agent Review",
  "Enterprise Server API",
  "Notification Integrations",
  "Multi-Language SDK",
  "Compliance Dashboard",
];

export function Features() {
  return (
    <section id="features" className="bg-dot-grid py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Features</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Engineered to Enforce
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {highlightedFeatures.map((feature) => (
            <Card
              key={feature.title}
              className="border-2 hover:border-(--color-text-primary)/30 transition-colors duration-200"
            >
              <CardContent className="pt-6">
                <div className="flex h-10 w-10 items-center justify-center border-2 border-(--color-text-primary)/20">
                  <feature.icon className="h-5 w-5 text-(--color-text-primary)" />
                </div>
                <h3 className="mt-4 font-mono text-base font-bold">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-(--color-text-secondary) leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* More features summary */}
        <div className="mt-8 border-2 border-dashed border-(--color-text-primary)/20 p-6">
          <div className="flex items-center gap-3">
            <span className="stamp text-(--color-text-primary) text-xs">
              {moreFeatures.length}+ more
            </span>
            <span className="font-mono text-sm text-(--color-text-secondary)">
              Everything else you need to ship with confidence
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {moreFeatures.map((name) => (
              <span
                key={name}
                className="inline-block font-mono text-xs px-2.5 py-1 border border-(--color-text-primary)/15 text-(--color-text-secondary)"
              >
                {name}
              </span>
            ))}
          </div>
          <a
            href="https://github.com/ylcn91/rulebound#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-(--color-text-primary) hover:underline underline-offset-4 cursor-pointer"
          >
            See full feature list
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
