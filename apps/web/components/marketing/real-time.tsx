import { Radar, MonitorDot, Eye, ShieldCheck } from "lucide-react";

const layers = [
  {
    icon: Radar,
    title: "Gateway Proxy",
    tag: "LLM LAYER",
    description:
      "Intercepts every LLM API call. Buffers streaming responses, scans completed code blocks with AST analysis. Strict mode blocks violations before they reach your editor.",
  },
  {
    icon: MonitorDot,
    title: "LSP Diagnostics",
    tag: "IDE LAYER",
    description:
      "Real-time inline warnings as you type. 300ms debounced AST + semantic analysis. Violations appear as underlines in your editor — same as TypeScript errors.",
  },
  {
    icon: Eye,
    title: "Watch CLI",
    tag: "FILE LAYER",
    description:
      "Monitors your working directory for file changes. Every save triggers validation against your rules. Pretty terminal output or JSON for CI pipelines.",
  },
  {
    icon: ShieldCheck,
    title: "MCP Pre-Write Gate",
    tag: "AGENT LAYER",
    description:
      "AI agents must pass validate_before_write before creating any file. Unapproved code is blocked at the source — before it touches your repo.",
  },
];

export function RealTime() {
  return (
    <section className="bg-(--color-background) py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Real-Time</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Enforcement That Never Sleeps
        </h2>
        <p className="mt-4 max-w-2xl text-(--color-text-secondary) leading-relaxed">
          Rulebound doesn&apos;t wait for commit time. It actively monitors,
          intercepts, and enforces at every stage of your AI-assisted workflow
          &mdash; from the LLM response stream to your IDE gutter.
        </p>

        <div className="mt-12 grid gap-px bg-(--color-text-primary)/10 border-2 border-(--color-text-primary)/10 sm:grid-cols-2">
          {layers.map((layer) => (
            <div
              key={layer.title}
              className="relative bg-(--color-background) p-6 group"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-(--color-text-primary) bg-(--color-surface)">
                  <layer.icon className="h-5 w-5 text-(--color-text-primary)" />
                </div>
                <div className="min-w-0">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
                    {layer.tag}
                  </span>
                  <h3 className="mt-0.5 font-mono text-base font-bold">
                    {layer.title}
                  </h3>
                  <p className="mt-2 text-sm text-(--color-text-secondary) leading-relaxed">
                    {layer.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
