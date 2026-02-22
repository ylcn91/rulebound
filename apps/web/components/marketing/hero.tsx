import { ArrowRight } from "lucide-react";
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
          <span className="text-[#e6e1cf]">rulebound generate</span>
        </p>
        <p className="mt-1 text-[#e6e1cf]">
          &nbsp;&nbsp;CLAUDE.md
        </p>
        <p className="text-[#e6e1cf]">
          &nbsp;&nbsp;.cursor/rules.md
        </p>
        <p className="text-[#e6e1cf]">
          &nbsp;&nbsp;.github/copilot-instructions.md
        </p>
        <p className="mt-1 text-[#aad94c]">
          Generated 3 config files. Ready to ship.
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
        <div className="stamp text-(--color-accent) text-base mb-6">Open Source</div>
        <h1 className="font-mono text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-(--color-text-primary)">
          Your AI Coding Agent
          <br />
          Doesn&apos;t Know Your Rules.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-(--color-text-secondary) leading-relaxed">
          Coding agents like Claude Code and Cursor are fast. But without your
          team&apos;s standards, they&apos;re fast in the wrong direction. Rulebound
          automatically gives your AI the context it needs &mdash; every time.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <a
            href="https://github.com/ylcn91/rulebound"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 font-mono text-sm font-semibold uppercase tracking-wider bg-(--color-text-primary) text-(--color-background) hover:opacity-90 transition-opacity duration-200 rounded-none border-2 border-(--color-text-primary)"
          >
            Get Started
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#features"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 font-mono text-sm font-semibold uppercase tracking-wider bg-transparent text-(--color-text-primary) border-2 border-(--color-text-primary) hover:bg-(--color-text-primary)/5 transition-colors duration-200 rounded-none"
          >
            See How It Works
          </a>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">Works with</span>
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
