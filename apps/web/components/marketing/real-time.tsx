import { Radar, MonitorDot, Eye, ShieldCheck } from "lucide-react";

const layers = [
  {
    icon: Radar,
    title: "CLI Check",
    tag: "AUTHORITATIVE",
    description:
      "rulebound check is the deterministic gate for local work and CI. It blocks only on machine-checkable findings.",
  },
  {
    icon: MonitorDot,
    title: "MCP Feedback",
    tag: "AGENT LAYER",
    description:
      "Agents can discover rules, validate plans as advisory feedback, check diffs, and request repair instructions before they claim completion.",
  },
  {
    icon: Eye,
    title: "CI Evidence",
    tag: "PR LAYER",
    description:
      "GitHub annotations, SARIF, and PR markdown expose deterministic blockers, warnings, waivers, and analyzer evidence.",
  },
  {
    icon: ShieldCheck,
    title: "Optional Surfaces",
    tag: "ADVANCED",
    description:
      "The dashboard, gateway, server, and LSP are secondary surfaces with explicit readiness caveats, not the first-run path.",
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
          Rulebound gives agents fast feedback, but keeps the authority simple:
          deterministic evidence blocks, advisory review warns, and CI can rerun
          the same checks without trusting an LLM explanation.
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
