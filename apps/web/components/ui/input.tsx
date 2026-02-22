import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full border-2 border-(--color-border) bg-(--color-surface) px-3 py-2",
        "font-mono text-sm text-(--color-text-primary)",
        "placeholder:text-(--color-muted)",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-text-primary)",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-colors duration-200",
        className
      )}
      {...props}
    />
  )
);

Input.displayName = "Input";

export { Input };
