import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "rules/rule-inheritance",
  title: "Rule Inheritance",
  description:
    "Share rule sets across projects using extends in config.json. Local rules override inherited ones.",
  content: `## Rule Inheritance

Rulebound supports rule inheritance so teams can share a base set of rules across multiple projects while allowing each project to customize or override specific rules.

### How It Works

In \`.rulebound/config.json\`, the \`extends\` array specifies paths to parent rule sets:

\`\`\`json
{
  "extends": [
    "../shared-rules/.rulebound/rules",
    "@company/engineering-rules"
  ],
  "rulesDir": ".rulebound/rules"
}
\`\`\`

Rulebound loads rules in this order:

1. **Inherited rules** from each \`extends\` path (in order)
2. **Local rules** from \`rulesDir\`

Local rules **override** inherited rules with the same ID. This lets you customize specific rules for a project while keeping the rest from the shared set.

### Path Resolution

Extends paths are resolved in this order:

| Path Type | Example | Resolution |
|-----------|---------|------------|
| Relative | \`../shared/.rulebound/rules\` | Resolved from project root |
| Absolute | \`/opt/rules/company\` | Used as-is |
| Package | \`@company/rules\` | \`node_modules/@company/rules/rules\` or \`node_modules/@company/rules/.rulebound/rules\` |

### Example: Shared Company Rules

Create a shared rules package:

\`\`\`
@company/engineering-rules/
  .rulebound/
    rules/
      security/
        no-secrets.md
        input-validation.md
      style/
        naming.md
\`\`\`

In each project:

\`\`\`json
{
  "extends": ["@company/engineering-rules"],
  "rulesDir": ".rulebound/rules"
}
\`\`\`

### Overriding Rules

If a local rule has the same ID as an inherited rule, the local version wins. Rule IDs are derived from file paths:

\`\`\`
# Inherited from @company/rules
security.no-secrets  (from security/no-secrets.md)

# Local override
security.no-secrets  (from .rulebound/rules/security/no-secrets.md)
\`\`\`

The local \`security/no-secrets.md\` replaces the inherited one entirely.

### Inherited Rule Display

When listing rules, inherited rules are prefixed with \`[inherited]\`:

\`\`\`bash
rulebound rules list
\`\`\`

\`\`\`
  [ERROR] [MUST] No Hardcoded Secrets
    [inherited] security/no-secrets.md

  [WARNING] [SHOULD] Naming Conventions
    style/naming.md
\`\`\`

### Multi-Level Inheritance

You can chain inheritance across multiple levels, but each level only looks at its own \`extends\`. Rulebound does not recursively resolve inherited configs.

### Best Practices

- Keep shared rules focused on universal standards (security, error handling)
- Let project rules handle stack-specific or team-specific standards
- Use consistent file paths across projects so rule IDs match for overrides
- Publish shared rules as npm packages for easy version management
`,
}

export default doc
