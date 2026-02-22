import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "stamp";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-xs font-semibold uppercase tracking-wider",
        {
          default:
            "bg-(--color-grid) text-(--color-text-secondary) px-2 py-0.5 border border-(--color-border)",
          accent:
            "bg-(--color-accent)/10 text-(--color-accent) px-2 py-0.5 border border-(--color-accent)/30",
          stamp:
            "stamp text-(--color-text-primary)",
        }[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
