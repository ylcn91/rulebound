export default function Home() {
  return (
    <main className="min-h-screen bg-grid">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h1 className="font-mono text-5xl font-bold tracking-tight">
          Your AI Coding Agent
          <br />
          Doesn&apos;t Know Your Rules.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-(--color-text-secondary)">
          Coding Agents like Claude Code and Cursor are fast. But without your
          org&apos;s standards, they&apos;re fast in the wrong direction.
          Rulebound automatically gives your AI the context it needs.
        </p>
      </div>
    </main>
  );
}
