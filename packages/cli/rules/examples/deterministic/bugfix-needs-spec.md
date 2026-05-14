---
title: Bugfix branch requires a bugfix spec
category: workflow
severity: error
modality: must
tags: [bugfix, workflow, agent-process, deterministic]
checks:
  - type: diff-evidence
    id: bugfix-spec-present
    branch_matches: '^fix/'
    require_changed:
      - ".rulebound/bugfixes/*.md"
    severity: error
    message: "Branch fix/* must include a bugfix spec under .rulebound/bugfixes/."
  - type: agent-process
    id: bugfix-spec-agent-signal
    require: bugfix_spec_present
    severity: warning
    message: "Agent did not register a bugfix spec before this run."
---

# Bugfix branch requires a bugfix spec

Branches named `fix/...` must carry a bugfix spec produced via
`rulebound bugfix start`. The spec captures bug condition C, postcondition P,
preservation scenarios, and scope so a reviewer can verify the change is
behavior-preserving outside of C.

The deterministic check ensures the spec lands in the same diff that
introduces the fix. A waiver can be granted for docs-only fixes through
`.rulebound/waivers.yaml`.
