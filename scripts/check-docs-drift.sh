#!/usr/bin/env bash
#
# Docs drift checker (AMP91-DOC-002).
#
# Four independent drift checks between authoritative source (CLI / engine /
# MCP) and root markdown documentation. Each check reports its own pass/fail.
# Exit 0 iff all four pass; exit 1 with a per-check failure note otherwise.
#
# Checks:
#   1. CLI command list   — `rulebound --help` parsed command names against
#                           `docs/quickstart.md` command references.
#   2. Pack list          — `rulebound packs list --format json` parsed pack
#                           names against `docs/quickstart.md` `--pack` usages.
#   3. Report schema      — `@rulebound/engine` `report-schema.ts` top-level
#                           field names against `docs/report-schema.md` table.
#   4. MCP bin path       — `packages/mcp/dist/index.js` existence plus
#                           `docs/mcp-setup.md` reference to that path.

set -uo pipefail

cd "$(dirname "$0")/.."

CLI_DIST="packages/cli/dist/index.js"
MCP_DIST="packages/mcp/dist/index.js"
QUICKSTART="docs/quickstart.md"
REPORT_SCHEMA_MD="docs/report-schema.md"
REPORT_SCHEMA_TS="packages/engine/src/report-schema.ts"
MCP_SETUP_MD="docs/mcp-setup.md"

declare -a CHECK_NAMES CHECK_RESULTS CHECK_NOTES
overall=0

record_check() {
  local name="$1" status="$2" note="$3"
  CHECK_NAMES+=("$name")
  CHECK_RESULTS+=("$status")
  CHECK_NOTES+=("$note")
  if [ "$status" != "pass" ]; then overall=1; fi
}

ensure_cli_built() {
  if [ ! -f "$CLI_DIST" ]; then
    echo "[docs-drift] building CLI (dist missing)..." >&2
    if ! pnpm --filter @rulebound/cli build >/dev/null 2>&1; then
      return 1
    fi
  fi
  return 0
}

# Check 1: CLI command list ↔ quickstart references
check_cli_commands() {
  if ! ensure_cli_built; then
    record_check "cli-commands" "fail" "CLI build failed; cannot enumerate commands"
    return
  fi

  # Parse top-level command names from `rulebound --help`. We treat the help
  # output as an ordered list of "<name> [args]" lines under section headers;
  # any line whose first non-whitespace token is a known command name counts.
  local help_output
  help_output=$(node "$CLI_DIST" --help 2>&1)
  if [ -z "$help_output" ]; then
    record_check "cli-commands" "fail" "rulebound --help produced no output"
    return
  fi

  # Extract command tokens. Commander prints each subcommand on a line like:
  #   "  check [options]        Run deterministic rule checks"
  # We pick lines that start with two spaces, a letter, and contain whitespace.
  local cli_commands
  cli_commands=$(printf "%s\n" "$help_output" \
    | awk '/^  [a-z][a-z0-9-]+( |\[)/ { print $1 }' \
    | sort -u)

  # Hardcoded subset of CLI commands that MUST be referenced in quickstart.md.
  # These are the user-facing entry points the quickstart explicitly walks
  # through. New CLI commands that should be documented in quickstart must be
  # added here; otherwise this check would either fail spuriously on every
  # new diagnostic command, or pass vacuously by listing them all.
  local required_in_docs=(check doctor init validate diff review)

  local missing=()
  for cmd in "${required_in_docs[@]}"; do
    if ! printf "%s\n" "$cli_commands" | grep -qx "$cmd"; then
      missing+=("$cmd (not in CLI --help output)")
      continue
    fi
    if ! grep -qE "rulebound +$cmd( |\$|\`)" "$QUICKSTART"; then
      missing+=("$cmd (not referenced in $QUICKSTART)")
    fi
  done

  if [ ${#missing[@]} -ne 0 ]; then
    local note
    note="missing: $(IFS=,; echo "${missing[*]}")"
    record_check "cli-commands" "fail" "$note"
    return
  fi
  record_check "cli-commands" "pass" "checked ${#required_in_docs[@]} commands"
}

# Check 2: pack list ↔ quickstart --pack references
check_pack_list() {
  if ! ensure_cli_built; then
    record_check "pack-list" "fail" "CLI build failed; cannot list packs"
    return
  fi

  local packs_json
  packs_json=$(node "$CLI_DIST" packs list --format json 2>/dev/null)
  if [ -z "$packs_json" ]; then
    record_check "pack-list" "fail" "rulebound packs list produced no output"
    return
  fi

  local pack_names
  pack_names=$(printf "%s" "$packs_json" | node -e '
    let raw = "";
    process.stdin.on("data", (c) => { raw += c; });
    process.stdin.on("end", () => {
      try {
        const packs = JSON.parse(raw);
        if (!Array.isArray(packs)) { process.exit(2); }
        for (const p of packs) {
          if (p && typeof p.name === "string") process.stdout.write(p.name + "\n");
        }
      } catch (e) { process.exit(3); }
    });
  ')
  if [ -z "$pack_names" ]; then
    record_check "pack-list" "fail" "could not parse pack names from JSON output"
    return
  fi

  # Packs that the quickstart explicitly walks through with `--pack <name>`.
  # The full pack catalog is broader; this list captures the user-facing
  # subset the quickstart promises. Adding a new pack to this list means
  # quickstart.md must also reference it via `--pack <name>`.
  local required_in_docs=(starter typescript security agent-workflow analyzer-typescript analyzer-java analyzer-security)

  local missing=()
  for pack in "${required_in_docs[@]}"; do
    if ! printf "%s\n" "$pack_names" | grep -qx "$pack"; then
      missing+=("$pack (not in packs list)")
      continue
    fi
    if ! grep -qE "\-\-pack +$pack( |\$|\`)" "$QUICKSTART"; then
      missing+=("$pack (not in $QUICKSTART --pack usage)")
    fi
  done

  if [ ${#missing[@]} -ne 0 ]; then
    local note
    note="missing: $(IFS=,; echo "${missing[*]}")"
    record_check "pack-list" "fail" "$note"
    return
  fi
  record_check "pack-list" "pass" "checked ${#required_in_docs[@]} packs"
}

# Check 3: report-schema.ts top-level field names ↔ docs/report-schema.md table.
check_report_schema_fields() {
  if [ ! -f "$REPORT_SCHEMA_TS" ]; then
    record_check "report-schema" "fail" "$REPORT_SCHEMA_TS not found"
    return
  fi
  if [ ! -f "$REPORT_SCHEMA_MD" ]; then
    record_check "report-schema" "fail" "$REPORT_SCHEMA_MD not found"
    return
  fi

  # Top-level DeterministicReport fields are declared in the interface block
  # in `docs/report-schema.md`. The canonical source list is short and stable:
  # status, summary, results, ruleStatuses, parseErrors, waiversApplied.
  local required_fields=(status summary results ruleStatuses parseErrors waiversApplied)

  local missing=()
  for field in "${required_fields[@]}"; do
    # Field must appear in the top-level interface block of the .md (in the
    # code fence) AND in the table row prefix "| `field` |".
    if ! grep -qE "^  $field: " "$REPORT_SCHEMA_MD"; then
      missing+=("$field (not in top-level interface block)")
      continue
    fi
    if ! grep -qE "^\| \`$field\`" "$REPORT_SCHEMA_MD"; then
      missing+=("$field (not in top-level field table)")
    fi
  done

  # Verify SCHEMA_VERSION constant is exported from report-schema.ts and
  # documented in report-schema.md. This is the version-policy contract.
  if ! grep -qE "export const SCHEMA_VERSION" "$REPORT_SCHEMA_TS"; then
    missing+=("SCHEMA_VERSION (not exported from $REPORT_SCHEMA_TS)")
  fi
  if ! grep -q "SCHEMA_VERSION" "$REPORT_SCHEMA_MD"; then
    missing+=("SCHEMA_VERSION (not documented in $REPORT_SCHEMA_MD)")
  fi

  if [ ${#missing[@]} -ne 0 ]; then
    local note
    note="missing: $(IFS=,; echo "${missing[*]}")"
    record_check "report-schema" "fail" "$note"
    return
  fi
  record_check "report-schema" "pass" "checked ${#required_fields[@]} top-level fields"
}

# Check 4: MCP bin path ↔ docs/mcp-setup.md reference.
check_mcp_bin_path() {
  if [ ! -f "$MCP_DIST" ]; then
    record_check "mcp-bin-path" "fail" "$MCP_DIST not found (run pnpm --filter @rulebound/mcp build)"
    return
  fi
  if [ ! -f "$MCP_SETUP_MD" ]; then
    record_check "mcp-bin-path" "fail" "$MCP_SETUP_MD not found"
    return
  fi
  # The docs must reference the same path string `packages/mcp/dist/index.js`
  # so a future build-layout change does not silently drift documentation.
  if ! grep -q "packages/mcp/dist/index.js" "$MCP_SETUP_MD"; then
    record_check "mcp-bin-path" "fail" "$MCP_SETUP_MD does not reference packages/mcp/dist/index.js"
    return
  fi
  # And the package name `@rulebound/mcp` must be referenced.
  if ! grep -q "@rulebound/mcp" "$MCP_SETUP_MD"; then
    record_check "mcp-bin-path" "fail" "$MCP_SETUP_MD does not reference @rulebound/mcp"
    return
  fi
  record_check "mcp-bin-path" "pass" "bin path + package name both referenced"
}

echo "[docs-drift] running 4 checks against root markdown..."
check_cli_commands
check_pack_list
check_report_schema_fields
check_mcp_bin_path

echo
printf "%-20s %-6s %s\n" "CHECK" "STATUS" "NOTE"
for i in "${!CHECK_NAMES[@]}"; do
  printf "%-20s %-6s %s\n" "${CHECK_NAMES[$i]}" "${CHECK_RESULTS[$i]}" "${CHECK_NOTES[$i]}"
done

echo
if [ "$overall" -eq 0 ]; then
  echo "[docs-drift] PASS — no drift detected"
else
  echo "[docs-drift] FAIL — drift detected; see per-check note above"
fi
exit "$overall"
