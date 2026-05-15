import type { DocPage } from "../registry"

const doc: DocPage = {
  slug: "deployment/packaging",
  title: "Packaging & Release",
  description:
    "How Rulebound packages are built, what ends up in a tarball, and how to verify a release locally before publishing to npm.",
  content: `## Packaging & Release

This page describes how Rulebound packages are built, what ends up in a tarball, and how to verify a release locally before publishing to npm.

## Layout

All publishable packages live under \`packages/*\` in the monorepo. The CLI is the primary production surface; everything else either supports it or is opt-in.

| Package | Purpose | Has \`bin\` |
| --- | --- | --- |
| \`@rulebound/cli\` | End-user CLI (\`rulebound\`) | yes |
| \`@rulebound/engine\` | Rule loading, deterministic validation engine | no |
| \`@rulebound/shared\` | Logger, shared utilities | no |
| \`@rulebound/mcp\` | MCP server for AI agents | yes |
| \`@rulebound/gateway\` | LLM proxy gateway (preview, self-hosted) | yes |
| \`@rulebound/lsp\` | LSP server (experimental) | yes |
| \`@rulebound/server\` | Optional HTTP API server (advanced) | yes |
| \`@rulebound/rules-*\` | Rule packs (typescript, react, security) | no |

Each \`package.json\` carries the same baseline metadata fields: \`name\`, \`version\`, \`description\`, \`license\`, \`repository\`, \`homepage\`, \`bugs\`, \`keywords\`, \`type: "module"\`, \`main\`, \`types\`, and a \`files\` allowlist.

## Pre-publish hooks

The CLI package depends on example rules that live at the monorepo root ([\`examples/rules/\`](https://github.com/ylcn91/rulebound/tree/main/examples/rules)). They are copied into \`packages/cli/rules/examples/\` before publish:

- \`packages/cli/scripts/copy-examples.mjs\` mirrors the examples tree into \`packages/cli/rules/examples/\`.
- \`pnpm build\` runs the script after \`tsup\`.
- \`pnpm pack\` runs the same script via \`prepack\` so a release tarball always ships fresh examples even if the local build is stale.

The CLI \`package.json\` \`files\` field whitelists \`dist\`, \`rules\`, \`README.md\`, and \`LICENSE\`. Anything else is excluded.

## What \`pnpm pack\` produces

\`\`\`bash
cd packages/cli
pnpm pack --pack-destination /tmp/rulebound-release
# -> /tmp/rulebound-release/rulebound-cli-0.1.0.tgz
\`\`\`

The tarball contains:

- \`package/package.json\` — with \`workspace:*\` ranges rewritten to concrete versions (e.g. \`"@rulebound/engine": "0.1.0"\`).
- \`package/dist/\` — bundled CLI entry (esm, sourcemap, \`.d.ts\` if emitted).
- \`package/rules/examples/\` — bundled example rules (copied by \`prepack\`).

\`@rulebound/engine\` and \`@rulebound/shared\` must be packed separately. When publishing through \`pnpm publish -r --filter '@rulebound/*'\`, pnpm handles this in dependency order.

## Local smoke test

\`scripts/smoke-test-cli.sh\` is the canonical end-to-end packaging check. It:

1. Builds \`@rulebound/cli\` and its workspace deps.
2. Runs \`pnpm pack\` for \`@rulebound/shared\`, \`@rulebound/engine\`, and \`@rulebound/cli\` into a temp directory.
3. Creates a fresh temp project, \`npm init -y\`, installs all three tarballs with \`npm install --no-save\`.
4. Runs \`rulebound init --examples --no-hook\`, then \`rulebound doctor\`, then \`rulebound check --format json\`, asserting that example rules are copied and the JSON output carries a \`summary\` block.
5. Verifies pack installability for curated packs such as \`typescript\` and \`security\` when the packed CLI exposes \`init --pack\`.
6. Verifies invalid waivers fail closed instead of silently passing.
7. Cleans up the temp project and tarballs on exit.

Run it any time you change CLI packaging, \`files\`, \`bin\`, or workspace dependencies:

\`\`\`bash
bash scripts/smoke-test-cli.sh
\`\`\`

The script exits non-zero on any failure. Treat a green smoke test as the minimum bar before tagging a release.

## Pre-publish checklist

Before \`npm publish\` (or \`pnpm publish -r\`):

- [ ] \`pnpm install --frozen-lockfile\` succeeds on a clean clone.
- [ ] \`pnpm lint\` and \`pnpm test\` are green.
- [ ] \`pnpm build\` succeeds for every workspace package.
- [ ] \`bash scripts/smoke-test-cli.sh\` is green.
- [ ] \`rulebound init --pack typescript --pack security --no-hook\` works from the packed CLI in a temp project.
- [ ] Invalid \`.rulebound/waivers.yaml\` exits non-zero in the packed CLI smoke.
- [ ] \`node packages/cli/dist/index.js check --format json\` runs against this repo's own \`.rulebound/rules/\` without schema errors.
- [ ] Versions in \`packages/*/package.json\` are bumped consistently (Rulebound packages share a major/minor today).
- [ ] CHANGELOG entry exists (when one is added — currently maintained per commit log).
- [ ] No accidental files in \`dist/\` (check \`pnpm pack --dry-run\`).
- [ ] Secret scan (e.g. \`gitleaks detect\`) is clean on \`HEAD\`.

## Publishing

Workspace publish in dependency order:

\`\`\`bash
pnpm -r --filter '@rulebound/shared' publish --access public
pnpm -r --filter '@rulebound/engine' publish --access public
pnpm -r --filter '@rulebound/cli'    publish --access public
# Then optional advanced packages:
pnpm -r --filter '@rulebound/mcp'      publish --access public
pnpm -r --filter '@rulebound/gateway'  publish --access public
pnpm -r --filter '@rulebound/lsp'      publish --access public
pnpm -r --filter '@rulebound/server'   publish --access public
\`\`\`

Add \`--dry-run\` first to verify the file list and resolved versions for each package.

## After publish

- Tag the release in git: \`git tag -a v0.1.0 -m "v0.1.0"\` and push tags.
- Verify the published artifact with a real install:

  \`\`\`bash
  npx -y -p @rulebound/cli@latest rulebound --version
  \`\`\`

- Update README install instructions if any package name moved.

## Related

- [Release Gate](/docs/ci/release-gate) — the canonical pre-release check sequence.
- [\`rulebound init\`](/docs/cli/init) — entry point exercised by the smoke test.
`,
}

export default doc
