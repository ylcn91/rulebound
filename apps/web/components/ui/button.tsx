import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline";
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
          "inline-flex cursor-pointer items-center justify-center font-sans font-medium transition-colors duration-200",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary)",
          "disabled:pointer-events-none disabled:opacity-50",
          {
            primary:
              "bg-(--color-primary) text-white hover:bg-(--color-primary-hover)",
            secondary:
              "bg-(--color-surface) text-(--color-text-primary) border border-(--color-border) hover:bg-(--color-grid)",
            ghost:
              "text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-grid)",
            outline:
              "border border-(--color-border) text-(--color-text-primary) hover:bg-(--color-surface)",
          }[variant],
          {
            sm: "h-8 px-3 text-sm rounded",
            md: "h-10 px-4 text-sm rounded-md",
            lg: "h-12 px-6 text-base rounded-md",
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
