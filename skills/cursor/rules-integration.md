# Rulebound Integration for Cursor

## Setup

1. Initialize rulebound in your project:
   ```bash
   npx rulebound init
   ```

2. Add your rules to `.rulebound/rules/` as markdown files.

3. Generate Cursor config:
   ```bash
   npx rulebound generate --agent cursor
   ```
   This creates `.cursor/rules.md` with all your engineering rules.

4. Commit `.cursor/rules.md` — Cursor reads it automatically.

## Updating Rules

When rules change, regenerate:
```bash
npx rulebound generate --agent cursor
```

## Task-Specific Rules

Generate rules for a specific task:
```bash
npx rulebound generate --agent cursor --task "building authentication"
```

Only relevant rules are included, keeping context focused.
