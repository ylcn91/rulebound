---
name: develop-with-rules
description: Develop features with Rulebound rule enforcement. Fetches matching rules before development, injects them as constraints, and validates before completing.
---

# Develop with Rules

When invoked, follow this workflow:

## 1. Gather Context

Identify the task context from the current conversation:
- What feature or change is being implemented?
- What categories apply? (architecture, security, style, testing, performance)

## 2. Fetch Matching Rules

Run the Rulebound CLI to find applicable rules:

```bash
rulebound find-rules --title "<task keywords>" --format json
```

If the task relates to a specific category:

```bash
rulebound find-rules --category <category> --format json
```

## 3. Inject Rules as Constraints

For each returned rule, treat it as a hard constraint:
- **error** severity: MUST be followed. Violation blocks completion.
- **warning** severity: SHOULD be followed. Document any intentional deviation.
- **info** severity: CONSIDER following. Note awareness.

Display the active rules to the user before proceeding:
```
ACTIVE RULES FOR THIS TASK:
- [ERROR] Rule Title — brief summary
- [WARN]  Rule Title — brief summary
```

## 4. Develop Following Rules

Implement the feature while adhering to all active rules. Reference specific rules when making implementation decisions.

## 5. Validate Before Completing

Before marking the task as done, validate the implementation:

```bash
rulebound validate --file <plan-or-summary-file>
```

Or inline:

```bash
rulebound validate --plan "Summary of what was implemented: ..."
```

If validation returns any FAIL results, fix the issues before completing.
Report the validation summary to the user.
