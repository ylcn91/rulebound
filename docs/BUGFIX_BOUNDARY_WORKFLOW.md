# Bugfix Boundary Workflow

## Problem

AI coding agents frequently fix the reported bug **and** accidentally change behavior outside the intended scope. The result is a patch that resolves one defect while silently regressing unrelated flows.

The core problem is not just “bad code generation.” It is the absence of an explicit, testable boundary between:

- inputs where behavior **must change**
- inputs where behavior **must stay identical**

## External Reference

Kiro describes this as the **bug fix paradox** and proposes a workflow based on:

- bug condition `C`
- postcondition `P`
- fix property: `C => P`
- preservation property: `not C => unchanged`

Reference:

- [The bug fix paradox: why AI agents keep breaking working code](https://kiro.dev/blog/bug-fix-paradox/)

## Why Rulebound Should Own This

Rulebound already enforces coding standards and analyzes code, plans, diffs, and AI outputs. But today it mostly answers:

- “Does this change violate rules?”

It does **not** fully answer:

- “Did this bugfix stay inside the intended behavior boundary?”

That gap is exactly where the bug-fix paradox lives.

Rulebound is a strong fit because it already has:

- plan validation
- diff validation
- AST analysis
- gateway interception
- MCP pre-write gates
- telemetry, audit, and compliance

So the missing capability is not a new product direction. It is a new **behavior-preserving bugfix workflow** layered on top of the existing enforcement engine.

## Proposed Feature

Add a new workflow tentatively named:

- `Bugfix Boundary Workflow`

This workflow turns an implicit bug report into an explicit contract:

1. `Bug Condition (C)`
2. `Expected Fix / Postcondition (P)`
3. `Preservation Requirements`
4. `Root Cause Hypothesis`
5. `Fix Tests`
6. `Preservation Tests`

Rulebound should then require the agent to:

- define the bug boundary before coding
- generate tests before patching
- prove the patch fixes the bug
- prove behavior outside the bug condition is preserved

## MVP Scope

### 1. New CLI entrypoint

Add a command such as:

- `rulebound bugfix`

Inputs:

- bug description text
- optional stack/language
- optional files or diff scope

Outputs:

- a bugfix spec document
- proposed root cause hypothesis
- required preservation scenarios
- generated test checklist or test files

### 2. Bugfix spec artifact

Store bugfix sessions in a structured file such as:

- `.rulebound/bugfixes/<slug>.md`

Suggested sections:

- Summary
- Bug condition `C`
- Postcondition `P`
- Unchanged behavior
- Root cause hypothesis
- Tests to add
- Files in scope
- Files explicitly out of scope

This artifact becomes the source of truth for the rest of the workflow.

### 3. MCP / agent workflow support

Expose MCP tools such as:

- `start_bugfix_workflow`
- `propose_bug_boundary`
- `validate_bugfix_plan`
- `validate_preservation`

Goal:

- before the agent writes code, it must formalize the bug boundary
- before the patch is accepted, it must show preservation evidence

### 4. Diff / patch gating

Add a new validation mode for bugfixes:

- reject changes outside declared scope unless justified
- reject patches that add unrelated refactors
- reject patches that lack fix tests and preservation tests

This can reuse:

- `diff`
- `validate`
- gateway response scanning
- MCP `validate_before_write`

### 5. Test-first enforcement

For bugfix mode, Rulebound should require:

- at least one failing scenario tied to `C`
- at least one preservation scenario outside `C`

For TypeScript/JavaScript first, Rulebound can generate:

- Vitest or Jest tests
- differential assertions where feasible

## How It Works in Practice

### Step 1: User reports the bug

Example:

> “Deleting a user fails when the account has no billing profile, but all other deletes work.”

### Step 2: Rulebound derives the contract

It proposes:

- `C`: delete request where account exists and billing profile is null
- `P`: delete succeeds without crash and account is removed
- preservation: delete behavior for accounts with billing profile remains unchanged

### Step 3: Agent confirms/refines

The user or agent adjusts the boundary if needed.

### Step 4: Tests are generated before patching

Rulebound creates:

- fix test(s) for `C`
- preservation test(s) for `not C`

### Step 5: Patch is written

Patch must:

- satisfy the fix tests
- preserve the preservation tests
- remain inside declared file/scope boundaries

### Step 6: Rulebound validates final patch

It checks:

- rules compliance
- scope compliance
- fix property
- preservation property

## Suggested Architecture Changes

### Engine

Add a bugfix-specific analysis layer:

- `BugCondition`
- `Postcondition`
- `PreservationScenario`
- `BugfixValidationReport`

### CLI

Add:

- `bugfix`
- `bugfix validate`
- `bugfix diff`

### MCP

Add:

- workflow tools for spec creation and preservation validation

### Gateway

In bugfix sessions, append additional context:

- “Do not refactor outside the bug boundary”
- “Preserve behavior outside C”

### Web

Add a dashboard surface for bugfix specs:

- list bugfix sessions
- inspect generated boundary/spec
- compare fix vs preservation outcomes

## Recommended Rollout

### Phase 1

Deliver CLI + spec artifact only.

Goal:

- make bug boundaries explicit
- produce bugfix docs

### Phase 2

Add MCP enforcement and pre-write gating.

Goal:

- stop uncontrolled bugfix drift at authoring time

### Phase 3

Add test generation and preservation validation.

Goal:

- turn the workflow into a real correctness gate

### Phase 4

Add dashboard and telemetry.

Goal:

- measure how often bugfixes drift
- track preservation failures over time

## What Success Looks Like

After this feature ships, Rulebound should be able to say:

- this patch fixes the reported bug
- this patch stayed inside the intended bug boundary
- this patch preserved behavior outside that boundary

That is the actual solution to the bug-fix paradox.

## Immediate Next Steps

1. Add `bugfix` workflow design to the roadmap.
2. Implement the CLI/spec artifact MVP first.
3. Add MCP tools for bugfix boundary creation.
4. Enforce preservation-aware validation in bugfix mode.
5. Add TypeScript-first generated fix/preservation tests.
