"use client"

import Link from "next/link"
import Markdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkGfm from "remark-gfm"

const linkClassName = "text-(--color-text-primary) underline underline-offset-4 decoration-1 decoration-(--color-border) hover:decoration-(--color-text-primary) transition-colors duration-150 cursor-pointer"

const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-mono text-3xl font-bold text-(--color-text-primary) mb-6 mt-2 tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-mono text-xl font-bold text-(--color-text-primary) mt-10 mb-4 pb-2 border-b-2 border-(--color-border) tracking-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-mono text-lg font-bold text-(--color-text-primary) mt-8 mb-3 tracking-tight">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="font-mono text-base font-bold text-(--color-text-primary) mt-6 mb-2">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="text-base text-(--color-text-secondary) leading-7 mb-4">
      {children}
    </p>
  ),
  a: ({ href, children }) => {
    if (href?.startsWith("/")) {
      return (
        <Link href={href as string} className={linkClassName}>
          {children}
        </Link>
      )
    }
    return (
      <a href={href} className={linkClassName} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-4 space-y-1 text-(--color-text-secondary)">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-1 text-(--color-text-secondary)">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-base leading-7">{children}</li>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-")
    if (isBlock) {
      return (
        <code className="block text-sm leading-6">{children}</code>
      )
    }
    return (
      <code className="font-mono text-sm bg-(--color-grid) px-1.5 py-0.5 border border-(--color-border) text-(--color-text-primary)">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <div className="terminal mb-6 mt-2">
      <div className="terminal-header">
        <span className="terminal-dot" style={{ backgroundColor: "#ff5f56" }} />
        <span className="terminal-dot" style={{ backgroundColor: "#ffbd2e" }} />
        <span className="terminal-dot" style={{ backgroundColor: "#27c93f" }} />
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-6">{children}</pre>
    </div>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-(--color-border) pl-4 my-4 text-(--color-muted) italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm border-collapse border-2 border-(--color-border)">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-(--color-grid)">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-2 border-(--color-border) px-4 py-2 text-left font-mono text-xs uppercase tracking-widest text-(--color-muted)">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-2 border-(--color-border) px-4 py-2 text-(--color-text-secondary)">
      {children}
    </td>
  ),
  hr: () => <div className="divider-dots my-8" role="separator" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-(--color-text-primary)">{children}</strong>
  ),
}

interface DocContentProps {
  readonly content: string
}

export function DocContent({ content }: DocContentProps) {
  return (
    <article className="max-w-none">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>{content}</Markdown>
    </article>
  )
}
