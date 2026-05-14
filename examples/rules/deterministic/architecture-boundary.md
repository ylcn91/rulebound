---
title: Domain must not import from infra
category: architecture
severity: error
modality: must
tags: [architecture, boundary, deterministic, import]
stack: [typescript, javascript]
checks:
  - type: forbidden-import
    id: domain-no-infra
    from:
      - "src/domain/**"
      - "packages/*/src/domain/**"
    importing:
      - "../infra"
      - "../infra/*"
      - "../../infra"
      - "src/infra/*"
    severity: error
    message: "Domain layer must not depend on infra. Invert the dependency via a port."
---

# Domain must not import from infra

Domain code defines invariants; infra holds adapters. When domain reaches into
infra, the domain becomes untestable without spinning up the database, queue,
or HTTP client. The fix is dependency inversion: domain declares the port,
infra implements it, the composition root wires them.

This is a deterministic structural rule. Hexagonal/clean/onion architecture
all agree on the direction.
