import { Database, Crosshair, ShieldCheck, Blocks, GitBranch, BarChart3, Layers, Terminal, FileOutput, GitCompare, Award, GitCommitHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    title: "Centralized Rule Hub",
    description:
      "Store all your engineering rules in one place. Organize by domain, team, or project. Version-controlled and always in sync.",
    icon: Database,
  },
  {
    title: "Generate Agent Configs",
    description:
      "One command generates CLAUDE.md, .cursor/rules.md, and copilot-instructions.md. Same rules, every agent, zero drift.",
    icon: FileOutput,
  },
  {
    title: "Task Plan Validation",
    description:
      "Before code ships, validate the AI agent's plan against your rules. PASS, WARN, or FAIL — with suggested fixes.",
    icon: ShieldCheck,
  },
  {
    title: "Diff Validation",
    description:
      "Run rulebound diff to validate git changes against your rules. Catch violations before they hit your codebase.",
    icon: GitCompare,
  },
  {
    title: "Compliance Score",
    description:
      "Get a 0-100 compliance score for your rule set. Generate a badge for your README. Track quality over time.",
    icon: Award,
  },
  {
    title: "Pre-Commit Hook",
    description:
      "Install a git hook that validates every commit against your rules. Block violations before they enter the repo.",
    icon: GitCommitHorizontal,
  },
  {
    title: "Quality Attributes",
    description:
      "Score rules on Atomicity, Completeness, and Clarity. Ensure every rule is actionable, unambiguous, and enforceable.",
    icon: BarChart3,
  },
  {
    title: "Multi-Agent Support",
    description:
      "Works with Claude Code, Cursor, GitHub Copilot, and more. One set of rules, every agent, every project.",
    icon: Blocks,
  },
  {
    title: "Rule Versioning",
    description:
      "Track every change to your rules with git. Roll back, compare versions, and audit who changed what and when.",
    icon: GitBranch,
  },
  {
    title: "Rule Inheritance",
    description:
      "Create base rule sets and extend them per project. Override specific rules without duplicating entire sets.",
    icon: Layers,
  },
  {
    title: "Dynamic Context Selection",
    description:
      "Rulebound analyzes each task and selects only the relevant rules. No context window bloat — just the rules that matter.",
    icon: Crosshair,
  },
  {
    title: "CLI-First Workflow",
    description:
      "Install the CLI, run find-rules and validate from your terminal. Integrates with CI/CD pipelines and git hooks.",
    icon: Terminal,
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

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-2 hover:border-(--color-text-primary)/30 transition-colors duration-200">
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
      </div>
    </section>
  );
}
