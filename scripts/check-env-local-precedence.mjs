import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const envPath = path.join(root, '.env')
const envLocalPath = path.join(root, '.env.local')

function parseEnvKeys(filePath) {
  if (!fs.existsSync(filePath)) return []
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => line.split('=')[0]?.trim())
    .filter(Boolean)
}

if (!fs.existsSync(envPath) || !fs.existsSync(envLocalPath)) {
  process.exit(0)
}

const envKeys = parseEnvKeys(envPath)
const envLocalKeys = parseEnvKeys(envLocalPath)
const onlyInEnv = envKeys.filter((key) => !envLocalKeys.includes(key))

if (onlyInEnv.length > 0) {
  console.error('[env-check] Found keys only in .env (not in .env.local):')
  onlyInEnv.forEach((key) => console.error(`- ${key}`))
  process.exit(1)
}

console.log('[env-check] .env.local covers all .env keys.')
