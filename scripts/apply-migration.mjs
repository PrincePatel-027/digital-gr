/**
 * Apply a SQL migration file to the Supabase Postgres database.
 *
 * Usage:
 *   node scripts/apply-migration.mjs supabase/migrations/20260726000500_schools_rls.sql
 *
 * Connects directly with SUPABASE_DB_PASSWORD (same approach as lib/setup-phase2.ts).
 * Statements are run inside a single transaction, so a failure rolls everything back
 * rather than leaving RLS half-applied.
 */
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/apply-migration.mjs <path-to-.sql>')
  process.exit(1)
}
if (!fs.existsSync(file)) {
  console.error(`Migration file not found: ${file}`)
  process.exit(1)
}

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const password = env.SUPABASE_DB_PASSWORD
if (!url || !password) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local')
  process.exit(1)
}

const projectRef = new URL(url).hostname.split('.')[0]
const sqlText = fs.readFileSync(file, 'utf8')

// Try the direct host first, then the pooler (some networks block 5432).
const candidates = [
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`,
  `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
]

let lastErr
for (const [i, conn] of candidates.entries()) {
  const sql = postgres(conn, { ssl: 'require', connect_timeout: 20, max: 1, prepare: false })
  try {
    console.log(`Connecting (attempt ${i + 1}/${candidates.length})…`)
    await sql.begin(async (tx) => {
      await tx.unsafe(sqlText)
    })
    console.log(`Applied ${path.basename(file)} successfully.`)
    await sql.end()
    process.exit(0)
  } catch (err) {
    lastErr = err
    console.log(`  failed: ${err.message.split('\n')[0]}`)
    try { await sql.end() } catch {}
  }
}

console.error(`\nCould not apply the migration: ${lastErr?.message}`)
console.error('Fallback: paste the SQL into the Supabase dashboard → SQL Editor.')
process.exit(1)
