import { checkCommand } from "./check.js"
import type { CheckOptions } from "./check.js"

export interface EvidenceOptions extends Omit<CheckOptions, "format"> {
  readonly format?: CheckOptions["format"]
}

export async function evidenceCommand(opts: EvidenceOptions): Promise<void> {
  const format: CheckOptions["format"] = opts.format ?? "pr-markdown"
  await checkCommand({ ...opts, format })
}
