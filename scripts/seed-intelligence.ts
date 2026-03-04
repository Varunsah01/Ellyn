#!/usr/bin/env node
/**
 * Seed script: learned_patterns (intelligence injection)
 *
 * Usage:
 *   npx tsx scripts/seed-intelligence.ts                # upserts into DB
 *   npx tsx scripts/seed-intelligence.ts --dry-run      # preview without writing
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// --- Load .env.local manually (no dotenv dependency needed) ---
async function loadEnvFile() {
  const envPath = path.join(ROOT, '.env.local')
  try {
    const text = await readFile(envPath, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      const unquoted = /^["'](.*)["']$/.exec(val)?.[1] ?? val
      if (key && !(key in process.env)) {
        process.env[key] = unquoted
      }
    }
  } catch {
    // .env.local not found — rely on environment variables already set
  }
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(`--${flag}`)
}

interface SeedPattern {
  company_domain: string
  pattern: string
  success_count: number
  failure_count: number
  confidence_boost: number
}

const BATCH_SIZE = 100

async function upsertBatch(
  rows: Array<SeedPattern & { injected: boolean; last_verified: string; updated_at: string }>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ count: number }> {
  const url = `${supabaseUrl}/rest/v1/learned_patterns`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase upsert failed (${res.status}): ${body}`)
  }

  return { count: rows.length }
}

async function main() {
  await loadEnvFile()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const dryRun = hasFlag('dry-run')

  if (!dryRun) {
    if (!supabaseUrl) {
      console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL env var is required')
      process.exit(1)
    }
    if (!serviceRoleKey) {
      console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY env var is required')
      process.exit(1)
    }
  }

  // Read source JSON
  const jsonPath = path.join(ROOT, 'data', 'seed-patterns.json')
  const rawJson = await readFile(jsonPath, 'utf8')
  const patterns: SeedPattern[] = JSON.parse(rawJson)

  console.log(`Loaded ${patterns.length} seed patterns from ${jsonPath}`)

  if (dryRun) {
    console.log('\nSample patterns:')
    patterns.slice(0, 10).forEach((p) =>
      console.log(`  ${p.company_domain.padEnd(30)} → ${p.pattern.padEnd(12)} boost=${p.confidence_boost}`)
    )
    console.log(`\n[dry-run] No data written. ${patterns.length} patterns would be upserted.`)
    return
  }

  const now = new Date().toISOString()
  let totalUpserted = 0

  for (let i = 0; i < patterns.length; i += BATCH_SIZE) {
    const batch = patterns.slice(i, i + BATCH_SIZE).map((p) => ({
      ...p,
      injected: true,
      last_verified: now,
      updated_at: now,
    }))

    const { count } = await upsertBatch(batch, supabaseUrl!, serviceRoleKey!)
    totalUpserted += count
    process.stdout.write(`\rUpserted ${totalUpserted}/${patterns.length} patterns...`)
  }

  console.log(`\nDone! Upserted ${totalUpserted} patterns into learned_patterns.`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
