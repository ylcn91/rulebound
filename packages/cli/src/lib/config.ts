import Conf from "conf"

const DEFAULT_SERVER_URL = "http://localhost:3000"

interface ConfigStore {
  serverUrl: string
  token: string | null
  currentProject: string | null
}

const config = new Conf<ConfigStore>({
  projectName: "rulebound",
  defaults: {
    serverUrl: DEFAULT_SERVER_URL,
    token: null,
    currentProject: null,
  },
})

export function getToken(): string | null {
  return config.get("token")
}

export function setToken(token: string): void {
  config.set("token", token)
}

export function clearToken(): void {
  config.set("token", null)
}

export function getServerUrl(): string {
  return config.get("serverUrl")
}

export function setServerUrl(url: string): void {
  config.set("serverUrl", url)
}

export function getCurrentProject(): string | null {
  return config.get("currentProject")
}

export function setCurrentProject(project: string): void {
  config.set("currentProject", project)
}

export function isAuthenticated(): boolean {
  return config.get("token") !== null
}
