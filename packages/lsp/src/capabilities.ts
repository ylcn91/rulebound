import {
  TextDocumentSyncKind,
  type ServerCapabilities,
} from "vscode-languageserver/node.js"

export const SERVER_CAPABILITIES: ServerCapabilities = {
  textDocumentSync: TextDocumentSyncKind.Full,
  diagnosticProvider: {
    interFileDependencies: false,
    workspaceDiagnostics: false,
  },
}
