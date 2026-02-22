# CLAUDE.md — Rulebound Project Rules

Dogfooding: this project uses its own product concept.

## Project

Open-source AI coding agent rule enforcement platform.
Monorepo: Turborepo + pnpm workspaces.

## Stack

- Next.js 16.1.6 + React 19 + Tailwind CSS 4
- Radix UI primitives + custom styled components
- Lucide Icons (SVG only, NO emoji as icons)
- Drizzle ORM + PostgreSQL 17
- TypeScript strict mode

## Design Rules

- Paper/Ink/Blueprint aesthetic with retro touch
- Light mode: krem bg (#FAFAF5), ink black text (#1C1917), blueprint blue primary (#2563EB)
- Dark mode: stone-900 bg (#1C1917), paper white text (#FAFAF5), blue-500 primary (#3B82F6)
- Font: JetBrains Mono (headings, code) + IBM Plex Sans (body)
- NO emoji in UI — use Lucide SVG icons
- Section labels: uppercase mono tracking-widest (PROBLEM, SOLUTION, etc.)
- Grid paper or dot-grid backgrounds
- Retro stamp badges, dot-matrix dividers
- Terminal-style code blocks with cursor blink
- All clickable elements: cursor-pointer
- Hover transitions: 150-300ms, no layout shift
- prefers-reduced-motion: disable all animations

## Code Style

- Server Components by default, "use client" only when needed
- Use @/ path alias for imports
- cn() for class merging (clsx + tailwind-merge)
- Tailwind v4 CSS variables via @theme
- No inline styles unless CSS can't express it
- Component files: PascalCase (Button.tsx)
- Utility files: camelCase (utils.ts)

## File Structure

- app/(marketing)/ — landing, pricing, about, faq
- app/(auth)/ — login, signup
- app/(dashboard)/ — rules, projects, import, settings
- app/api/ — route handlers
- components/ui/ — base primitives
- components/marketing/ — landing page sections
- components/dashboard/ — dashboard components
- components/shared/ — header, footer, theme toggle
- lib/db/ — Drizzle schema, connection
- lib/auth/ — NextAuth config

## Accessibility

- WCAG AA minimum (4.5:1 text contrast)
- Semantic HTML (button, nav, main, section, article)
- All images: alt text
- Focus states visible
- Keyboard navigable
- Color not sole indicator

## Git

- Conventional commits (feat:, fix:, docs:, style:, refactor:)
- Branch from main
- PR required for merge
