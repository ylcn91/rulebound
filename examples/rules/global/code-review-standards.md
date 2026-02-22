---
title: Code Review Standards
category: style
severity: warning
modality: must
tags: [review, pr, quality]
stack: []
scope: [all]
---

# Code Review Standards

Every pull request MUST follow these standards before merge. AI-generated code is held to the same bar as human-written code.

## Rules

- PRs must have a clear description of what changed and why
- Every PR must have at least one approval from a team member
- No TODO comments without a linked issue
- No console.log/print statements in production code
- Functions must not exceed 50 lines; files must not exceed 400 lines
- All public APIs must have documentation
