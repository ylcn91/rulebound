---
title: Gateway must not log prompt or response bodies
category: security
severity: warning
modality: should
tags: [gateway, logging, privacy, pii]
stack: [typescript]
scope: [packages/gateway]
---

# Gateway must not log prompt or response bodies

The Rulebound gateway proxies LLM traffic. Logging full prompts or responses
through `console.log` leaks user input, secrets, and model output into log
sinks that may not be redacted.

If you need to debug payload shape, gate the log behind an explicit debug
config flag and redact PII before emitting — but do **not** use bare
`console.log` for prompt or response bodies in source files under
`packages/gateway/src/`.

```rulebound
checks:
  - type: regex
    id: gateway-no-prompt-log
    pattern: "console\.log\([^)]*\bprompt"
    files:
      - "packages/gateway/src/**/*.ts"
    forbidden: true
    severity: warning
    message: "Do not log prompt bodies via console.log in the gateway. Use a redacting logger gated by a debug flag."
  - type: regex
    id: gateway-no-response-log
    pattern: "console\.log\([^)]*\bresponse"
    files:
      - "packages/gateway/src/**/*.ts"
    forbidden: true
    severity: warning
    message: "Do not log response bodies via console.log in the gateway. Use a redacting logger gated by a debug flag."
```
