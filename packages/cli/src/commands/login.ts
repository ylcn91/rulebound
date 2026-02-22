import http from "node:http"
import chalk from "chalk"
import ora from "ora"
import open from "open"
import { getServerUrl, setToken } from "../lib/config.js"

export async function loginCommand(): Promise<void> {
  const serverUrl = getServerUrl()
  const spinner = ora("Starting authentication...").start()

  try {
    const { port, tokenPromise } = await startCallbackServer()

    const callbackUrl = `http://localhost:${port}/callback`
    const authUrl = `${serverUrl}/auth/cli-token?callback=${encodeURIComponent(callbackUrl)}`

    spinner.stop()
    console.log(chalk.blue("Opening browser for authentication..."))
    console.log(chalk.dim(`  ${authUrl}`))
    console.log()

    await open(authUrl)

    console.log(
      chalk.dim("Waiting for authentication... (press Ctrl+C to cancel)")
    )

    const token = await tokenPromise
    setToken(token)

    console.log()
    console.log(chalk.green("Authenticated successfully."))
    console.log(chalk.dim("Token stored in ~/.config/rulebound/config.json"))
  } catch (error) {
    spinner.stop()
    const message =
      error instanceof Error ? error.message : "Unknown error"
    console.error(chalk.red(`Authentication failed: ${message}`))
    process.exit(1)
  }
}

function startCallbackServer(): Promise<{
  port: number
  tokenPromise: Promise<string>
}> {
  return new Promise((resolveSetup, rejectSetup) => {
    let resolveToken: (token: string) => void
    let rejectToken: (error: Error) => void

    const tokenPromise = new Promise<string>((resolve, reject) => {
      resolveToken = resolve
      rejectToken = reject
    })

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost`)
      const token = url.searchParams.get("token")

      if (url.pathname === "/callback" && token) {
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end(
          "<html><body><h1>Authenticated!</h1><p>You can close this tab.</p></body></html>"
        )
        resolveToken(token)
        server.close()
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" })
        res.end("Missing token parameter")
      }
    })

    server.on("error", (error) => {
      rejectSetup(error)
      rejectToken(error)
    })

    server.listen(0, () => {
      const addr = server.address()
      if (typeof addr === "object" && addr !== null) {
        resolveSetup({ port: addr.port, tokenPromise })
      } else {
        rejectSetup(new Error("Failed to start callback server"))
      }
    })

    setTimeout(() => {
      server.close()
      rejectToken(new Error("Authentication timed out after 5 minutes"))
    }, 300_000)
  })
}
