"use client";

import { useEffect, useRef, useState } from "react";
import {
  Code2,
  Bot,
  Shield,
  Cloud,
  ScanSearch,
  BarChart3,
  Bell,
  ArrowDown,
} from "lucide-react";

interface NodeDef {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: typeof Code2;
}

const topRow: readonly NodeDef[] = [
  {
    id: "developer",
    label: "Developer",
    description: "Writes task prompt for AI agent",
    icon: Code2,
  },
  {
    id: "agent",
    label: "AI Agent",
    description: "Claude Code, Cursor, Copilot, etc.",
    icon: Bot,
  },
  {
    id: "gateway",
    label: "Gateway",
    description: "Intercepts request, injects rules into system prompt",
    icon: Shield,
  },
  {
    id: "llm",
    label: "LLM API",
    description: "OpenAI, Anthropic, Google — generates code",
    icon: Cloud,
  },
  {
    id: "engine",
    label: "Validation",
    description: "Keyword, Semantic, LLM, and AST analysis pipeline",
    icon: ScanSearch,
  },
];

const bottomRow: readonly NodeDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Compliance scores, audit log, trend charts",
    icon: BarChart3,
  },
  {
    id: "notify",
    label: "Notify",
    description: "Slack, Teams, Discord, PagerDuty alerts",
    icon: Bell,
  },
];

const allNodes: readonly NodeDef[] = [...topRow, ...bottomRow];

type Phase = "hidden" | "drawing" | "flowing";

export function ArchitectureFlow() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase("drawing");
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase === "drawing") {
      const timer = setTimeout(() => setPhase("flowing"), 2500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const isVisible = phase !== "hidden";

  return (
    <section ref={sectionRef} className="py-(--spacing-section) bg-grid">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Architecture</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          End-to-End Rule Enforcement
        </h2>
        <p className="mt-4 max-w-2xl text-(--color-text-secondary) leading-relaxed">
          From the moment a developer prompts an AI agent to the final
          compliance report — every step is governed by your rules.
        </p>

        {/* ── Desktop: grid layout ── */}
        <div className="mt-12 hidden lg:block">
          <div className="arch-grid">
            {/* Row 1: 5 top nodes */}
            {topRow.map((node, i) => (
              <div key={node.id} className="arch-cell arch-cell-top">
                <FlowNode
                  node={node}
                  index={i}
                  isVisible={isVisible}
                  tooltipSide="top"
                />
              </div>
            ))}

            {/* Row 2: connectors */}
            {/* col 1-4: horizontal segments between top nodes */}
            <Connector
              direction="horizontal"
              phase={phase}
              gridArea="2 / 1 / 3 / 2"
              delayed={false}
            />
            <Connector
              direction="horizontal"
              phase={phase}
              gridArea="2 / 2 / 3 / 3"
              delayed={false}
            />
            <Connector
              direction="horizontal"
              phase={phase}
              gridArea="2 / 3 / 3 / 4"
              delayed={false}
            />
            <Connector
              direction="horizontal"
              phase={phase}
              gridArea="2 / 4 / 3 / 5"
              delayed={false}
            />

            {/* Row 3: vertical drop from Gateway (col 3) */}
            <Connector
              direction="vertical"
              phase={phase}
              gridArea="3 / 3 / 4 / 4"
              delayed
            />

            {/* Row 4: horizontal spread left + right from center (col 3) */}
            <Connector
              direction="horizontal"
              phase={phase}
              gridArea="4 / 2 / 5 / 4"
              delayed
            />

            {/* Row 5: vertical drops to bottom nodes */}
            <Connector
              direction="vertical"
              phase={phase}
              gridArea="5 / 2 / 6 / 3"
              delayed
            />
            <Connector
              direction="vertical"
              phase={phase}
              gridArea="5 / 4 / 6 / 5"
              delayed
            />

            {/* Row 6: bottom nodes — Dashboard col 2, Notify col 4 */}
            <div style={{ gridArea: "6 / 2 / 7 / 3" }} className="arch-cell">
              <FlowNode
                node={bottomRow[0]}
                index={5}
                isVisible={isVisible}
                tooltipSide="bottom"
              />
            </div>
            <div style={{ gridArea: "6 / 4 / 7 / 5" }} className="arch-cell">
              <FlowNode
                node={bottomRow[1]}
                index={6}
                isVisible={isVisible}
                tooltipSide="bottom"
              />
            </div>
          </div>
        </div>

        {/* ── Mobile/Tablet: vertical flow ── */}
        <div className="mt-12 lg:hidden">
          <div className="flex flex-col items-center gap-6">
            {allNodes.map((node, i) => (
              <div key={node.id} className="flex flex-col items-center">
                <FlowNode
                  node={node}
                  index={i}
                  isVisible={isVisible}
                  showDescription
                  tooltipSide="bottom"
                />
                {i < allNodes.length - 1 && (
                  <ArrowDown
                    className={`h-5 w-5 text-(--color-muted) mt-3 ${phase === "flowing" ? "arch-arrow-pulse" : ""}`}
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-(--color-muted)">
          <span className="flex items-center gap-2">
            <span className="inline-block w-6 border-t-2 border-dashed border-(--color-border)" />
            Data flow
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 border-2 border-(--color-text-primary)" />
            Processing node
          </span>
        </div>
      </div>

      <style>{`
        .arch-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          grid-template-rows: auto 12px 32px 12px 32px auto;
          justify-items: center;
          align-items: center;
        }

        .arch-cell {
          display: flex;
          justify-content: center;
        }

        /* ── Connector base ── */
        .arch-connector {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .arch-connector::after {
          content: "";
          position: absolute;
          background: repeating-linear-gradient(
            90deg,
            var(--color-border) 0px,
            var(--color-border) 6px,
            transparent 6px,
            transparent 10px
          );
        }
        .arch-connector-h::after {
          top: 50%;
          left: 0;
          right: 0;
          height: 2px;
          transform: translateY(-50%);
        }
        .arch-connector-v::after {
          left: 50%;
          top: 0;
          bottom: 0;
          width: 2px;
          transform: translateX(-50%);
          background: repeating-linear-gradient(
            180deg,
            var(--color-border) 0px,
            var(--color-border) 6px,
            transparent 6px,
            transparent 10px
          );
        }

        /* ── Draw animation (clip reveal) ── */
        .arch-connector-draw-h::after {
          clip-path: inset(0 100% 0 0);
          animation: clipRevealH 1.2s ease-out forwards;
        }
        .arch-connector-draw-v::after {
          clip-path: inset(0 0 100% 0);
          animation: clipRevealV 1.2s ease-out forwards;
        }
        .arch-connector-draw-delay-h::after {
          clip-path: inset(0 100% 0 0);
          animation: clipRevealH 1.2s ease-out 0.8s forwards;
        }
        .arch-connector-draw-delay-v::after {
          clip-path: inset(0 0 100% 0);
          animation: clipRevealV 1.2s ease-out 0.8s forwards;
        }

        /* ── Flow animation (dash movement) ── */
        .arch-connector-flow-h::after {
          animation: flowH 0.6s linear infinite;
        }
        .arch-connector-flow-v::after {
          animation: flowV 0.6s linear infinite;
        }

        @keyframes clipRevealH {
          from { clip-path: inset(0 100% 0 0); }
          to { clip-path: inset(0 0% 0 0); }
        }
        @keyframes clipRevealV {
          from { clip-path: inset(0 0 100% 0); }
          to { clip-path: inset(0 0 0% 0); }
        }
        @keyframes flowH {
          from { background-position: 0 0; }
          to { background-position: 20px 0; }
        }
        @keyframes flowV {
          from { background-position: 0 0; }
          to { background-position: 0 20px; }
        }

        @keyframes archArrowPulse {
          0%, 100% { opacity: 0.4; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(3px); }
        }
        .arch-arrow-pulse {
          animation: archArrowPulse 1.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .arch-connector-draw-h::after,
          .arch-connector-draw-v::after,
          .arch-connector-draw-delay-h::after,
          .arch-connector-draw-delay-v::after,
          .arch-connector-flow-h::after,
          .arch-connector-flow-v::after {
            animation: none !important;
            clip-path: none !important;
          }
          .arch-arrow-pulse {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
    </section>
  );
}

function Connector({
  direction,
  phase,
  gridArea,
  delayed,
}: {
  direction: "horizontal" | "vertical";
  phase: Phase;
  gridArea: string;
  delayed: boolean;
}) {
  const dir = direction === "horizontal" ? "h" : "v";

  let animClass = "";
  if (phase === "drawing") {
    animClass = delayed
      ? `arch-connector-draw-delay-${dir}`
      : `arch-connector-draw-${dir}`;
  } else if (phase === "flowing") {
    animClass = `arch-connector-flow-${dir}`;
  }

  return (
    <div
      className={`arch-connector arch-connector-${dir} ${animClass}`}
      style={{ gridArea }}
      aria-hidden="true"
    />
  );
}

function FlowNode({
  node,
  index,
  isVisible,
  showDescription = false,
  tooltipSide = "top",
}: {
  node: NodeDef;
  index: number;
  isVisible: boolean;
  showDescription?: boolean;
  tooltipSide?: "top" | "bottom";
}) {
  const Icon = node.icon;
  const delay = index * 150;

  const tooltipPosition =
    tooltipSide === "top"
      ? "-top-14 left-1/2 -translate-x-1/2"
      : "-bottom-14 left-1/2 -translate-x-1/2";

  return (
    <div
      className={`group relative flex flex-col items-center w-28 ${!showDescription ? "cursor-pointer" : ""}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.4s ease-out ${delay}ms, transform 0.4s ease-out ${delay}ms`,
      }}
    >
      <div className="flex h-14 w-14 items-center justify-center border-2 border-(--color-text-primary) bg-(--color-surface) transition-colors duration-200 group-hover:bg-(--color-text-primary) group-hover:text-(--color-background)">
        <Icon className="h-6 w-6" />
      </div>
      <span className="mt-2 text-center font-mono text-xs font-bold uppercase tracking-wider">
        {node.label}
      </span>

      {showDescription ? (
        <p className="mt-1 text-center text-[11px] leading-snug text-(--color-text-secondary) w-40">
          {node.description}
        </p>
      ) : (
        <div
          className={`absolute ${tooltipPosition} w-48 px-3 py-2 bg-(--color-text-primary) text-(--color-background) text-[10px] leading-tight font-sans opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-20 text-center`}
          role="tooltip"
        >
          {node.description}
        </div>
      )}
    </div>
  );
}
