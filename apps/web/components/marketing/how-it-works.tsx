const steps = [
  {
    number: 1,
    title: "Define Your Rules",
    description: "Write plain-language engineering rules in Markdown. Group them by domain — security, testing, architecture, style.",
    code: `# security/input-validation.md

## Rule: Validate All User Input

- Use Zod schemas for every API endpoint
- Never trust client-side validation alone
- Sanitize HTML output to prevent XSS
- Log validation failures for monitoring`,
  },
  {
    number: 2,
    title: "Install the CLI",
    description: "One command to connect Rulebound to your workflow. Works with any AI coding agent.",
    code: `$ npm install -g @rulebound/cli

$ rulebound init
Initializing Rulebound...
Created .rulebound/config.yaml
Connected to your rule hub.
Ready.`,
  },
  {
    number: 3,
    title: "AI Gets Context",
    description: "When your AI agent starts a task, Rulebound finds the relevant rules and injects them automatically.",
    code: `$ rulebound find-rules --task "build checkout API"

Matching rules to task context...
  api/rest-conventions.md      (0.94)
  security/input-validation.md (0.91)
  testing/api-integration.md   (0.87)

3 rules injected into agent context.`,
  },
  {
    number: 4,
    title: "Validate & Ship",
    description: "Before merging, validate the AI's work against your rules. Catch issues before they reach production.",
    code: `$ rulebound validate --plan task-plan.json

Checking 3 rules against plan...
  rest-conventions     PASS
  input-validation     PASS
  api-integration      PASS

All rules passed. Ready to ship.`,
  },
];

export function HowItWorks() {
  return (
    <section className="bg-dot-grid py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Getting Started</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          How Rulebound Works
        </h2>

        <div className="mt-12 space-y-16">
          {steps.map((step) => (
            <div
              key={step.number}
              className="grid gap-8 items-start md:grid-cols-2"
            >
              <div>
                <span className="font-mono text-sm font-bold uppercase tracking-widest text-(--color-muted)">
                  Step {step.number}
                </span>
                <h3 className="mt-2 font-mono text-xl font-bold">
                  {step.title}
                </h3>
                <p className="mt-3 text-(--color-text-secondary) leading-relaxed">
                  {step.description}
                </p>
              </div>
              <div className="terminal shadow-lg">
                <div className="terminal-header">
                  <span className="terminal-dot bg-[#ff5f57]" />
                  <span className="terminal-dot bg-[#febc2e]" />
                  <span className="terminal-dot bg-[#28c840]" />
                </div>
                <pre className="p-5 text-xs leading-relaxed overflow-x-auto">
                  <code>{step.code}</code>
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
