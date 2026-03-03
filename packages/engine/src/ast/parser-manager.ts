import { createRequire } from "node:module"
import { join, extname } from "node:path"
import type Parser from "web-tree-sitter"
import type { SupportedLanguage } from "./types.js"
import { LANGUAGE_WASM_MAP, FILE_EXTENSION_MAP } from "./types.js"

let ParserCls: typeof Parser | null = null
let initialized = false
const languageCache = new Map<SupportedLanguage, Parser.Language>()

async function ensureInit(): Promise<void> {
  if (initialized) return

  const mod = await import("web-tree-sitter") as { default?: typeof Parser }
  ParserCls = mod.default ?? (mod as unknown as typeof Parser)
  await ParserCls.init()
  initialized = true
}

function getWasmPath(language: SupportedLanguage): string {
  const wasmFile = LANGUAGE_WASM_MAP[language]
  if (!wasmFile) throw new Error(`Unsupported language: ${language}`)

  const require = createRequire(import.meta.url)
  const wasmPkgDir = require.resolve("tree-sitter-wasms/package.json")
  return join(wasmPkgDir, "..", "out", wasmFile)
}

export async function loadLanguage(language: SupportedLanguage): Promise<Parser.Language> {
  const cached = languageCache.get(language)
  if (cached) return cached

  await ensureInit()
  const wasmPath = getWasmPath(language)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const lang = await ParserCls!.Language.load(wasmPath)
  languageCache.set(language, lang)
  return lang
}

export async function createParser(language: SupportedLanguage): Promise<Parser> {
  await ensureInit()
  const lang = await loadLanguage(language)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const parser = new ParserCls!()
  parser.setLanguage(lang)
  return parser
}

export function detectLanguageFromPath(filePath: string): SupportedLanguage | null {
  const ext = extname(filePath).toLowerCase()
  return FILE_EXTENSION_MAP[ext] ?? null
}

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return lang in LANGUAGE_WASM_MAP
}

export async function getQueryClass(): Promise<typeof Parser.Query> {
  await ensureInit()
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const cls = ParserCls! as typeof Parser & { Query?: typeof Parser.Query }
  return (cls.Language as typeof Parser.Language & { Query?: typeof Parser.Query }).Query ?? cls.Query!
}
