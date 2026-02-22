"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("rulebound-theme") as Theme | null;
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getInitialTheme());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("rulebound-theme", theme);
  }, [theme, mounted]);

  function toggle() {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }

  if (!mounted) {
    return (
      <button
        className={cn(
          "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md",
          "border border-(--color-border) text-(--color-text-secondary)",
          className
        )}
        aria-label="Toggle theme"
        disabled
      />
    );
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md",
        "border border-(--color-border) text-(--color-text-secondary)",
        "hover:text-(--color-text-primary) hover:bg-(--color-grid)",
        "transition-colors duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary)",
        className
      )}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}
