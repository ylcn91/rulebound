import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "success" | "accent" | "stamp";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-xs font-medium",
        {
          default:
            "bg-(--color-grid) text-(--color-text-secondary) px-2 py-0.5 rounded",
          primary:
            "bg-(--color-primary)/10 text-(--color-primary) px-2 py-0.5 rounded",
          success:
            "bg-(--color-success)/10 text-(--color-success) px-2 py-0.5 rounded",
          accent:
            "bg-(--color-accent)/10 text-(--color-accent) px-2 py-0.5 rounded",
          stamp:
            "stamp text-(--color-primary)",
        }[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
