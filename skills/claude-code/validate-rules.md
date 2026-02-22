---
name: validate-rules
description: Validate a spec, plan, or PR against Rulebound rules. Reports PASS/WARN/FAIL per rule.
---

# Validate Rules

When invoked, validate the current work against the project's Rulebound rules.

## 1. Identify What to Validate

Determine the validation target from context:
- A spec or plan document (file path or inline text)
- A PR description or diff
- A summary of recent changes

## 2. Fetch All Applicable Rules

```bash
rulebound find-rules --format json
```

If the scope is known, narrow by category:

```bash
rulebound find-rules --category security --format json
```

## 3. Run Validation

If a file exists:

```bash
rulebound validate --file <path-to-spec-or-plan>
```

If working with inline content, create a temporary summary and validate:

```bash
rulebound validate --plan "Description of changes: ..."
```

## 4. Report Results

Display results in a structured format:

```
RULE VALIDATION REPORT
──────────────────────────────────────
[PASS] Rule Title
  Plan addresses: keyword1, keyword2.

[WARN] Rule Title
  Plan partially addresses rule. Consider reviewing.

[FAIL] Rule Title
  Plan does not address required rule.
──────────────────────────────────────
Summary: 5 total | 3 pass | 1 warn | 1 fail
```

## 5. Recommend Actions

For each FAIL or WARN:
- Explain what the rule requires
- Suggest specific changes to achieve compliance
- Reference the rule ID for the user to inspect: `rulebound rules show <id>`
