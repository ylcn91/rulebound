---
title: Authentication and Authorization
category: security
severity: error
modality: must
tags: [auth, jwt, session, rbac]
---

# Authentication and Authorization

Every API endpoint MUST enforce authentication.

## Rules

- All endpoints must check authentication before processing
- Use httpOnly cookies for token storage
- Use short-lived JWT tokens with refresh rotation
