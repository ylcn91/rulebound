---
title: Git Author Identity Preservation
category: workflow
severity: error
modality: must
tags: [git, author, commit, identity, ai-agent]
stack: []
scope: []
---

# Git Author Identity Preservation

AI coding agents MUST NOT set themselves as the commit author.

## Rules

- Never modify `git config user.name` or `git config user.email`
- Preserve the original developer's git identity on all commits
- Use `Co-authored-by` trailer in commit messages for AI attribution
- Never use `--author` flag to override the committer
- The human developer who initiated the work is always the author

## Good Example

```bash
git commit -m "feat: add JWT authentication

Co-authored-by: claude-code[bot] <claude@anthropic.com>"
```

## Bad Example

```bash
# AI agent overriding author identity
git config user.name "Claude"
git config user.email "claude@anthropic.com"
git commit -m "feat: add JWT authentication"

# Or using --author flag
git commit --author="AI Agent <ai@bot.com>" -m "feat: add auth"
```
