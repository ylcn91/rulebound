# Validate with Rulebound Rules

Use this workflow to check existing work (your code or someone else's) against engineering rules.

## Validate a Plan or Spec

```bash
# Inline text
rulebound validate --plan "Add REST API endpoint for user registration with email/password"

# From file
rulebound validate --file spec.md

# JSON output (for programmatic use)
rulebound validate --plan "..." --format json
```

## Validate Code Changes

```bash
# Check uncommitted changes against HEAD
rulebound diff

# Check against a specific ref
rulebound diff --ref origin/main

# JSON output
rulebound diff --format json
```

## Understanding the Report

Each rule gets one of three statuses:

| Status | Icon | Meaning |
|--------|------|---------|
| **PASS** | ✓ | Work addresses the rule correctly |
| **VIOLATED** | ✗ | Work contradicts a mandatory rule — must fix |
| **NOT_COVERED** | ○ | Rule exists but not addressed — verify manually |

**Exit codes:**
- `0` — all rules passed (or passed with warnings)
- `1` — at least one MUST rule violated

## Check Rule Quality

```bash
# How well are your rules written?
rulebound rules lint

# Overall score
rulebound score
```

## CI Integration

Add to your GitHub Actions workflow:
```yaml
- name: Validate against rules
  run: |
    npx rulebound diff --ref origin/main
    npx rulebound score
```
