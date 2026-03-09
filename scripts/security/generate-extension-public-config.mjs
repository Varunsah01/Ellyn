#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

const ENV_FILES_IN_LOAD_ORDER = ['.env', '.env.local']
const OUTPUT_PATH = path.join(repoRoot, 'extension', 'public-config.js')
const REQUIRED_PUBLIC_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']

function parseEnvFile(content) {
  const parsed = {}
  const lines = String(content || '').split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq <= 0) continue

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (!key) continue

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    parsed[key] = value
  }

  return parsed
}

function loadEnvFromFiles(root) {
  const merged = {}

  for (const relativePath of ENV_FILES_IN_LOAD_ORDER) {
    const fullPath = path.join(root, relativePath)
    if (!fs.existsSync(fullPath)) continue

    const fileContent = fs.readFileSync(fullPath, 'utf8')
    Object.assign(merged, parseEnvFile(fileContent))
  }

  return merged
}

function resolvePublicConfig(root) {
  const fileEnv = loadEnvFromFiles(root)

  const resolved = {}
  for (const key of REQUIRED_PUBLIC_KEYS) {
    const fromProcess = (process.env[key] || '').trim()
    const fromFiles = (fileEnv[key] || '').trim()
    resolved[key] = fromProcess || fromFiles
  }

  return resolved
}

function assertPublicConfig(config) {
  const missing = REQUIRED_PUBLIC_KEYS.filter((key) => !config[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required public env keys: ${missing.join(', ')}. Set them in process env or .env.local.`
    )
  }
}

function renderConfigFile({ supabaseUrl, supabaseAnonKey }) {
  return `/* eslint-disable no-undef */
/*
 * GENERATED FILE - DO NOT COMMIT
 * Source: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
(function initEllynPublicConfig(scope) {
  scope.ELLYN_PUBLIC_CONFIG = Object.freeze({
    supabaseUrl: ${JSON.stringify(supabaseUrl)},
    supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
`
}

function main() {
  const config = resolvePublicConfig(repoRoot)
  assertPublicConfig(config)

  const fileOutput = renderConfigFile({
    supabaseUrl: config.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  fs.writeFileSync(OUTPUT_PATH, fileOutput, 'utf8')
  console.log('Generated extension/public-config.js')
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
