import chalk from "chalk"

const ASCII_ART = `
 ╔══════════════════════════════════════════════╗
 ║                                              ║
 ║   ██████  ██    ██ ██      ███████           ║
 ║   ██   ██ ██    ██ ██      ██                ║
 ║   ██████  ██    ██ ██      █████             ║
 ║   ██   ██ ██    ██ ██      ██                ║
 ║   ██   ██  ██████  ███████ ███████           ║
 ║                                              ║
 ║   ██████   ██████  ██    ██ ███    ██ ██████ ║
 ║   ██   ██ ██    ██ ██    ██ ████   ██ ██   ██║
 ║   ██████  ██    ██ ██    ██ ██ ██  ██ ██   ██║
 ║   ██   ██ ██    ██ ██    ██ ██  ██ ██ ██   ██║
 ║   ██████   ██████   ██████  ██   ████ ██████ ║
 ║                                              ║
 ╚══════════════════════════════════════════════╝
`

export function printBanner(version: string): void {
  console.log(chalk.blue(ASCII_ART))
  console.log(
    chalk.dim("  Your AI coding agent rule enforcement platform")
  )
  console.log(chalk.dim(`  v${version}`))
  console.log()
}
