import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "ci/release-gate",
  title: "Release Gate",
  description:
    "The canonical check sequence (install, lint, test, build, CLI smoke, self-check) that must pass before declaring a release candidate ready.",
  content: `## Release Gate

The release gate is the canonical check sequence that must pass before a release candidate is declared ready. It is wired as a single command.

## Run it

\`\`\`bash
pnpm release:gate
# or, skipping the native SDK build/test for a TS-only release run:
bash scripts/release-gate.sh --skip-sdks
# or, skipping the install step if you already ran it:
bash scripts/release-gate.sh --skip-install
\`\`\`

## Stages

| Stage         | What it does                                              | Exit code on failure |
|---------------|-----------------------------------------------------------|----------------------|
| install       | \`pnpm install --frozen-lockfile\`                          | non-zero             |
| lint          | \`pnpm lint\`                                               | non-zero             |
| test          | \`pnpm test\` (TS + native SDKs)                            | non-zero             |
| build         | \`pnpm build\` (TS + native SDKs)                           | non-zero             |
| smoke:cli     | Packs and installs the CLI in a temp dir, runs doctor/check | non-zero          |
| self-check    | \`rulebound check --format github --base main\`             | 1 if violations      |

A stage that exits with code 99 is treated as skipped (e.g. \`--skip-sdks\`). The final summary prints PASS/FAIL/SKIP per stage and the script exits non-zero if any required stage failed.

## When the native SDK gate is missing

If the local toolchain for a native SDK is not installed (e.g. .NET, Python, Rust), the gate must explicitly skip that stage and the release notes must record the gap. Do not claim success when a stage is silently skipped — that contradicts the production-readiness contract.

### Known toolchain gap: .NET

\`sdks/dotnet/Rulebound.csproj\` targets \`net8.0\`. The release gate environment must therefore provide a .NET SDK that can target .NET 8 (e.g. \`dotnet@8\` or \`dotnet@9\`). If only \`dotnet@6\` is on \`PATH\`, the SDK build fails with \`NETSDK1045: The current .NET SDK does not support targeting .NET 8.0\`.

Two acceptable options:

1. Install a .NET 8/9 SDK and re-run the gate.
2. Run with \`bash scripts/release-gate.sh --skip-sdks\` and record the \`.NET\` SDK as explicitly skipped in the release notes. Other native SDKs (Python, Go) continue to run.

## What this gate is NOT

- It is not a substitute for code review.
- It is not a performance / load test gate.
- It does not validate provider contracts for the gateway under live API drift. That is the job of separate provider smoke tests.

Use this gate immediately before tagging a release. If any stage fails, record the owner and resolve before shipping.

## Related

- [GitHub Action](/docs/ci/github-action) — the per-PR deterministic gate.
- [Packaging](/docs/deployment/packaging) — what \`smoke:cli\` exercises.
`,
}

export default doc
