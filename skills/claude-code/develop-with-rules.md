# Develop with Rulebound Rules

Use this workflow when starting any new feature, bugfix, or refactor.

## Before Coding

1. **Find relevant rules for your task:**
   ```bash
   rulebound find-rules --task "YOUR TASK DESCRIPTION" --format inject
   ```
   This outputs rules formatted for your context. Read them carefully.

2. **Write your implementation plan**, then validate it:
   ```bash
   rulebound validate --plan "YOUR PLAN" 
   ```
   Or from a file:
   ```bash
   rulebound validate --file plan.md
   ```

3. **Review the validation report:**
   - **PASS** — your plan addresses the rule
   - **VIOLATED** — your plan contradicts a rule, fix before coding
   - **NOT_COVERED** — rule exists but plan doesn't mention it, verify if applicable

4. **Adjust your plan** until validation passes, then start coding.

## During Coding

Follow the rules from step 1. When in doubt, run:
```bash
rulebound rules show <rule-id>
```

## After Coding

1. **Validate your changes against rules:**
   ```bash
   rulebound diff
   ```

2. **Fix any violations** before committing.

3. **Commit with confidence** — rules are satisfied.

## Quick Reference

| Command | When to use |
|---------|-------------|
| `rulebound find-rules --task "..." --format inject` | Start of task — load relevant rules |
| `rulebound validate --plan "..."` | Before coding — check your plan |
| `rulebound diff` | After coding — check your changes |
| `rulebound rules list` | See all available rules |
| `rulebound rules show <id>` | Deep-dive into a specific rule |
