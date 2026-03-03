import { Database, Crosshair, ShieldCheck, Blocks, GitBranch, BarChart3, Layers, Terminal, FileOutput, GitCompare, Award, GitCommitHorizontal, Shield, Workflow, Users, Plug, TreePine, Radar, Globe, Bell, Code2, Gauge } from "lucide-react";
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
  {
    title: "Enforcement Modes",
    description:
      "Choose advisory, moderate, or strict enforcement. Control when violations block commits and CI pipelines with configurable score thresholds.",
    icon: Shield,
  },
  {
    title: "CI/CD Pipeline",
    description:
      "Validate PR changes in CI with GitHub Actions annotations. Supports pretty, JSON, and GitHub output formats.",
    icon: Workflow,
  },
  {
    title: "Multi-Agent Review",
    description:
      "Define agent profiles with roles and rule scopes. Run multi-agent review with consensus across security, architecture, and style agents.",
    icon: Users,
  },
  {
    title: "MCP Server",
    description:
      "AI agents query and validate against rules in real-time via Model Context Protocol. Auto-detects project stack and filters rules.",
    icon: Plug,
  },
  {
    title: "AST Code Analysis",
    description:
      "Tree-sitter WASM parser detects structural anti-patterns across 10 languages. 28 built-in queries — no regex, real AST matching.",
    icon: TreePine,
  },
  {
    title: "LLM Gateway",
    description:
      "Transparent proxy between AI tools and LLM APIs. Injects rules into prompts, scans responses for violations in real-time.",
    icon: Radar,
  },
  {
    title: "Enterprise Server API",
    description:
      "Full REST API for centralized rule management, validation, compliance scoring, audit logging, and webhook orchestration.",
    icon: Globe,
  },
  {
    title: "Notification Integrations",
    description:
      "Slack, Microsoft Teams, Discord, and PagerDuty. Event-based routing with severity mapping for real-time violation alerts.",
    icon: Bell,
  },
  {
    title: "6-Language SDK",
    description:
      "Client libraries for Python, Go, TypeScript, Java, C#/.NET, and Rust. Same API surface, native HTTP, zero overhead.",
    icon: Code2,
  },
  {
    title: "Compliance Dashboard",
    description:
      "Real-time compliance scores, sparkline trends, audit log, webhook management. Full visibility into AI code quality.",
    icon: Gauge,
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
