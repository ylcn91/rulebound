import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const agents = ["Claude Code", "Cursor", "Copilot"];

function TerminalDemo() {
  return (
    <div className="terminal mt-10 w-full max-w-2xl shadow-lg">
      <div className="terminal-header">
        <span className="terminal-dot bg-[#ff5f57]" />
        <span className="terminal-dot bg-[#febc2e]" />
        <span className="terminal-dot bg-[#28c840]" />
        <span className="ml-2 text-xs text-[#5c6773]">terminal</span>
      </div>
      <div className="p-5 text-sm leading-relaxed">
        <p>
          <span className="text-[#39bae6]">$</span>{" "}
          <span className="text-[#e6e1cf]">rulebound find-rules</span>{" "}
          <span className="text-[#5c6773]">--task &quot;add auth flow&quot;</span>
        </p>
        <p className="mt-3 text-[#5c6773]">
          Searching rules for context...
        </p>
        <p className="mt-1 text-[#aad94c]">
          Found 4 matching rules:
        </p>
        <p className="mt-1 text-[#e6e1cf]">
          &nbsp;&nbsp;auth/session-management.md
        </p>
        <p className="text-[#e6e1cf]">
          &nbsp;&nbsp;security/input-validation.md
        </p>
        <p className="text-[#e6e1cf]">
          &nbsp;&nbsp;api/error-handling.md
        </p>
        <p className="text-[#e6e1cf]">
          &nbsp;&nbsp;testing/coverage-requirements.md
        </p>
        <p className="mt-3">
          <span className="text-[#39bae6]">$</span>{" "}
          <span className="text-[#e6e1cf]">rulebound validate</span>{" "}
          <span className="text-[#5c6773]">--plan task-plan.json</span>
        </p>
        <p className="mt-1 text-[#aad94c]">
          All rules passed. Ready to ship.
        </p>
        <span className="cursor-blink inline-block h-4 w-2 translate-y-0.5 bg-[#e6e1cf]" />
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative bg-grid overflow-hidden">
      <div className="paper-grain pointer-events-none absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32 md:pt-40 md:pb-32">
        <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-(--color-text-primary)">
          Your AI Coding Agent
          <br />
          Doesn&apos;t Know Your Rules.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-(--color-text-secondary)">
          Coding agents like Claude Code and Cursor are fast. But without your
          team&apos;s standards, they&apos;re fast in the wrong direction. Rulebound
          automatically gives your AI the context it needs &mdash; every time.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button size="lg" className="bg-(--color-success) hover:bg-[#15803d] gap-2">
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="text-sm text-(--color-muted)">Works with</span>
          {agents.map((agent) => (
            <Badge key={agent} variant="default">
              {agent}
            </Badge>
          ))}
        </div>

        <TerminalDemo />
      </div>
    </section>
  );
}
