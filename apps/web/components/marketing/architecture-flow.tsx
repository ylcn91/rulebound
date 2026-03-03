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
  ArrowRight,
} from "lucide-react";

const nodes = [
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

export function ArchitectureFlow() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-(--spacing-section) bg-grid">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Architecture</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          End-to-End Rule Enforcement
        </h2>
        <p className="mt-4 max-w-2xl text-(--color-text-secondary) leading-relaxed">
          From the moment a developer prompts an AI agent to the final compliance report — every step is governed by your rules.
        </p>

        {/* Desktop: horizontal flow */}
        <div className="mt-12 hidden lg:block">
          <div className="relative">
            {/* Connection lines */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1100 200"
              fill="none"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              {/* Main horizontal line through first 4 nodes */}
              <line
                x1="80" y1="70" x2="920" y2="70"
                stroke="var(--color-border)"
                strokeWidth="2"
                strokeDasharray="6 4"
                className={isVisible ? "arch-line-anim" : ""}
              />
              {/* Branch down from engine */}
              <line
                x1="690" y1="70" x2="690" y2="170"
                stroke="var(--color-border)"
                strokeWidth="2"
                strokeDasharray="6 4"
                className={isVisible ? "arch-line-anim-delay" : ""}
              />
              {/* Horizontal from engine to dashboard and notify */}
              <line
                x1="690" y1="170" x2="920" y2="170"
                stroke="var(--color-border)"
                strokeWidth="2"
                strokeDasharray="6 4"
                className={isVisible ? "arch-line-anim-delay" : ""}
              />
              <line
                x1="690" y1="170" x2="460" y2="170"
                stroke="var(--color-border)"
                strokeWidth="2"
                strokeDasharray="6 4"
                className={isVisible ? "arch-line-anim-delay" : ""}
              />
            </svg>

            {/* Top row: Developer -> Agent -> Gateway -> LLM -> Engine */}
            <div className="flex items-start justify-between relative z-10">
              {nodes.slice(0, 5).map((node, i) => (
                <FlowNode
                  key={node.id}
                  node={node}
                  index={i}
                  isVisible={isVisible}
                />
              ))}
            </div>

            {/* Bottom row: Dashboard + Notify (positioned below engine) */}
            <div className="flex justify-center gap-32 mt-8 relative z-10">
              <div className="ml-[26%]">
                <FlowNode
                  node={nodes[5]}
                  index={5}
                  isVisible={isVisible}
                />
              </div>
              <div className="mr-[2%]">
                <FlowNode
                  node={nodes[6]}
                  index={6}
                  isVisible={isVisible}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile/Tablet: vertical flow */}
        <div className="mt-12 lg:hidden">
          <div className="flex flex-col items-center gap-2">
            {nodes.map((node, i) => (
              <div key={node.id} className="flex flex-col items-center">
                <FlowNode
                  node={node}
                  index={i}
                  isVisible={isVisible}
                />
                {i < nodes.length - 1 && (
                  <ArrowRight
                    className="h-5 w-5 text-(--color-muted) rotate-90 my-1"
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

      <style jsx>{`
        @keyframes drawLine {
          from { stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
        .arch-line-anim {
          stroke-dashoffset: 1000;
          animation: drawLine 2s ease-out forwards;
        }
        .arch-line-anim-delay {
          stroke-dashoffset: 1000;
          animation: drawLine 2s ease-out 1s forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .arch-line-anim,
          .arch-line-anim-delay {
            animation: none;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </section>
  );
}

function FlowNode({
  node,
  index,
  isVisible,
}: {
  node: (typeof nodes)[number];
  index: number;
  isVisible: boolean;
}) {
  const Icon = node.icon;
  const delay = index * 150;

  return (
    <div
      className="group relative flex flex-col items-center w-28 cursor-pointer"
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

      {/* Tooltip */}
      <div
        className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-48 px-3 py-2 bg-(--color-text-primary) text-(--color-background) text-[10px] leading-tight font-sans opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-20 text-center"
        role="tooltip"
      >
        {node.description}
      </div>
    </div>
  );
}
