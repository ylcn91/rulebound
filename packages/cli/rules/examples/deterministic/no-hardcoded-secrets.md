---
title: No hardcoded credential-like assignments
category: security
severity: error
modality: must
tags: [security, secrets, deterministic, regex]
checks:
  - type: regex
    id: hardcoded-aws-access-key
    pattern: 'AKIA[0-9A-Z]{16}'
    severity: error
    message: "Potential AWS access key ID found."
  - type: regex
    id: hardcoded-private-key
    pattern: '-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----'
    severity: error
    message: "Private key block in source. Move to a secret store."
---

# No hardcoded credential-like assignments

Strings that look like API keys, tokens, or private keys must never land in
source control. Move them to environment variables backed by a secret store.
This rule is deterministic: the same input always reports the same finding,
no LLM involved.
