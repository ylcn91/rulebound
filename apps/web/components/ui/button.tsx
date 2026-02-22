import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center font-mono text-sm font-semibold uppercase tracking-wider transition-all duration-200 rounded-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-text-primary)",
          "disabled:pointer-events-none disabled:opacity-50",
          {
            primary:
              "bg-(--color-text-primary) text-(--color-background) border-2 border-(--color-text-primary) hover:opacity-90",
            secondary:
              "bg-(--color-surface) text-(--color-text-primary) border-2 border-(--color-border) hover:border-(--color-text-primary)",
            ghost:
              "text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-grid)",
            outline:
              "border-2 border-(--color-text-primary) text-(--color-text-primary) bg-transparent hover:bg-(--color-text-primary)/5",
            danger:
              "border-2 border-(--color-accent) text-(--color-accent) bg-transparent hover:bg-(--color-accent)/10",
          }[variant],
          {
            sm: "h-8 px-3 text-xs",
            md: "h-10 px-4",
            lg: "h-12 px-6",
          }[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
