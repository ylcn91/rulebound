import { createRequire } from "node:module"
import { join, extname } from "node:path"
import type { SupportedLanguage } from "./types.js"
import { LANGUAGE_WASM_MAP, FILE_EXTENSION_MAP } from "./types.js"

/* eslint-disable @typescript-eslint/no-explicit-any */
let ParserCls: any = null
let initialized = false
const languageCache = new Map<SupportedLanguage, any>()

async function ensureInit(): Promise<void> {
  if (initialized) return

  const mod: any = await import("web-tree-sitter")
  ParserCls = mod.default ?? mod.Parser ?? mod
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

export async function loadLanguage(language: SupportedLanguage): Promise<any> {
  const cached = languageCache.get(language)
  if (cached) return cached

  await ensureInit()
  const wasmPath = getWasmPath(language)
  const lang = await ParserCls.Language.load(wasmPath)
  languageCache.set(language, lang)
  return lang
}

export async function createParser(language: SupportedLanguage): Promise<any> {
  await ensureInit()
  const lang = await loadLanguage(language)
  const parser = new ParserCls()
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

export async function getQueryClass(): Promise<any> {
  await ensureInit()
  return ParserCls.Language.Query ?? ParserCls.Query
}
