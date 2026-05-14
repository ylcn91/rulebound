---
title: MCP tool changes require an MCP test update
category: testing
severity: error
modality: must
tags: [mcp, testing, evidence]
stack: [typescript]
scope: [packages/mcp]
---

# MCP tool changes require an MCP test update

When `packages/mcp/src/index.ts` is modified — the MCP server entry point and
tool wiring — the same change set must include at least one updated MCP test
file under `packages/mcp/src/__tests__/`.

This catches the common bug of adding/renaming/removing an MCP tool without
adjusting its integration coverage.

```rulebound
checks:
  - type: diff-evidence
    id: mcp-tool-needs-test
    severity: error
    when_changed:
      - "packages/mcp/src/index.ts"
    require_changed:
      - "packages/mcp/src/__tests__/**/*.test.ts"
    message: "MCP server entry changed without updating any MCP test under packages/mcp/src/__tests__/."
```
