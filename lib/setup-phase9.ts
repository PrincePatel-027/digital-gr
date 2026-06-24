/**
 * Phase 9 — Schema Update
 * Adds is_active to profiles
 */

import postgres from 'postgres'
import * as fs from 'fs'
import * as path from 'path'

// ── Load .env.local ───────────────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found')
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD!
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
const DB_URL = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${projectRef}.supabase.co:5432/postgres`

const sql = postgres(DB_URL, { ssl: 'require', connect_timeout: 15 })

async function runSQL(query: string, label: string) {
  try {
    await sql.unsafe(query)
    console.log(`  ✅ ${label}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`  ⏭️  ${label} (already exists)`)
    } else {
      throw new Error(`${label}: ${msg}`)
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 9 — Schema Setup')
  console.log('═══════════════════════════════════════════════\n')

  await runSQL(`
    ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;
  `, 'Add is_active to profiles')

  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('  🎉 Setup complete!')
  console.log('═══════════════════════════════════════════════')
  console.log('')

  await sql.end()
}

main().catch(async (err) => {
  console.error('\n❌ Setup failed:', err.message)
  await sql.end()
  process.exit(1)
})
