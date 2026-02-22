import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rulebound — AI Coding Agents That Follow Your Rules",
  description:
    "Centralized rules for AI Coding Agents. Your AI coding agent automatically picks the right rules per task. Ship enterprise-ready code at 10x speed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-(--color-background) text-(--color-text-primary) antialiased">
        {children}
      </body>
    </html>
  );
}
