/**
 * Advisory command banner.
 *
 * Legacy/advisory commands (`validate`, `diff`, `ci`, `review`) emit a one-line
 * banner reminding the user that these commands are NOT the deterministic gate
 * — `rulebound check` is. The banner is colored when chalk's color support is
 * active (chalk already respects `NO_COLOR`), and lands on stderr when the
 * command's primary output is a machine-readable format so consumers parsing
 * stdout (`JSON.parse`) are not disturbed.
 */
import chalk from "chalk"

export const ADVISORY_BANNER_TEXT =
  "[advisory] This command is not the deterministic gate. Run `rulebound check` for the authoritative pass/fail."

/**
 * Render the banner, respecting `NO_COLOR` (via chalk's level).
 */
function renderBanner(): string {
  return chalk.yellow(ADVISORY_BANNER_TEXT)
}

/**
 * Machine-readable output formats. When the banner would corrupt the primary
 * output channel (e.g. `JSON.parse(stdout)` would fail), the banner lands on
 * stderr instead.
 */
function isMachineFormat(format: string | undefined): boolean {
  if (!format) return false
  const normalized = format.toLowerCase()
  return (
    normalized === "json" ||
    normalized === "github" ||
    normalized === "sarif" ||
    normalized === "repair-json" ||
    normalized === "pr-markdown"
  )
}

/**
 * Print the advisory banner before a legacy/advisory command runs.
 *
 * - `format` machine-readable (json, github, sarif, repair-json, pr-markdown):
 *   banner goes to stderr.
 * - `format` human-readable (pretty / undefined): banner goes to stdout.
 */
export function printAdvisoryBanner(format?: string): void {
  const message = renderBanner()
  if (isMachineFormat(format)) {
    console.error(message)
  } else {
    console.log(message)
  }
}
