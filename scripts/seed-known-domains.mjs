#!/usr/bin/env node
/**
 * Seed script: known_company_domains
 *
 * Usage:
 *   node scripts/seed-known-domains.mjs                  # reads .env.local automatically
 *   node scripts/seed-known-domains.mjs --dry-run        # preview without writing
 *   node scripts/seed-known-domains.mjs --export-csv     # also write data/known-domains-500.csv
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { createReadStream } from 'node:fs'

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
      // Remove surrounding quotes if present
      const unquoted = /^["'](.*)["']$/.exec(val)?.[1] ?? val
      if (key && !(key in process.env)) {
        process.env[key] = unquoted
      }
    }
  } catch {
    // .env.local not found — rely on environment variables already set
  }
}

// --- CLI flags ---
function hasFlag(flag) {
  return process.argv.includes(`--${flag}`)
}

// --- Normalize a company name to a DB lookup key ---
function normalize(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// --- Expand JSON entries to flat DB rows ---
function expandEntries(entries) {
  const rows = []
  const seen = new Set()

  for (const entry of entries) {
    const { company_name, domain, category, employees, confidence, aliases = [] } = entry

    const canonical = { company_name, domain, category, employees, confidence }
    const normCanonical = normalize(company_name)
    if (normCanonical && !seen.has(normCanonical)) {
      seen.add(normCanonical)
      rows.push({ ...canonical, normalized_name: normCanonical })
    }

    for (const alias of aliases) {
      const normAlias = normalize(alias)
      if (normAlias && !seen.has(normAlias)) {
        seen.add(normAlias)
        rows.push({
          company_name: alias,
          domain,
          category,
          employees,
          confidence,
          normalized_name: normAlias,
        })
      }
    }
  }

  return rows
}

// --- Export CSV ---
async function exportCsv(rows) {
  const csvPath = path.join(ROOT, 'data', 'known-domains-500.csv')
  const header = 'company_name,normalized_name,domain,category,employees,confidence'
  const lines = rows.map((r) => {
    const esc = (v) => (String(v ?? '').includes(',') ? `"${v}"` : String(v ?? ''))
    return [
      esc(r.company_name),
      esc(r.normalized_name),
      esc(r.domain),
      esc(r.category ?? ''),
      esc(r.employees ?? ''),
      esc(r.confidence ?? 1.0),
    ].join(',')
  })
  await writeFile(csvPath, [header, ...lines].join('\n'), 'utf8')
  console.log(`CSV written to ${csvPath} (${rows.length} rows)`)
}

// --- Upsert to Supabase via REST ---
const BATCH_SIZE = 100

async function upsertBatch(rows, supabaseUrl, serviceRoleKey, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] Would upsert ${rows.length} rows`)
    return { count: 0 }
  }

  const url = `${supabaseUrl}/rest/v1/known_company_domains`
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

// --- Main ---
async function main() {
  await loadEnvFile()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const dryRun = hasFlag('dry-run')
  const exportCsvFlag = hasFlag('export-csv')

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
  const jsonPath = path.join(ROOT, 'data', 'known-domains-500.json')
  const rawJson = await readFile(jsonPath, 'utf8')
  const entries = JSON.parse(rawJson)

  console.log(`Loaded ${entries.length} canonical companies from ${jsonPath}`)

  // Expand aliases into flat rows
  const rows = expandEntries(entries)
  console.log(`Expanded to ${rows.length} DB rows (including aliases)`)

  if (exportCsvFlag) {
    await exportCsv(rows)
  }

  if (dryRun) {
    console.log('\nSample rows:')
    rows.slice(0, 5).forEach((r) =>
      console.log(`  ${r.normalized_name.padEnd(35)} → ${r.domain}`)
    )
    console.log(`\n[dry-run] No data written. ${rows.length} rows would be upserted.`)
    return
  }

  // Batch upsert
  let totalUpserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { count } = await upsertBatch(batch, supabaseUrl, serviceRoleKey, false)
    totalUpserted += count
    process.stdout.write(`\rUpserted ${totalUpserted}/${rows.length} rows...`)
  }

  console.log(`\nDone! Upserted ${totalUpserted} rows into known_company_domains.`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
