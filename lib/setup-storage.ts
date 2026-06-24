/**
 * Phase 5 — Storage Bucket Setup
 *
 * Creates the gr-images bucket and RLS policies.
 * Usage:  npx tsx lib/setup-storage.ts
 */

import { createClient } from '@supabase/supabase-js'
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
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD!
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
const DB_URL = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${projectRef}.supabase.co:5432/postgres`

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
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
  console.log('  Phase 5 — Storage Bucket Setup')
  console.log('═══════════════════════════════════════════════\n')

  // ── Step 1: Create bucket ───────────────────────────────
  console.log('📦 Step 1: Creating gr-images bucket...')

  const { error: bucketError } = await supabase.storage.createBucket('gr-images', {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024, // 10 MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
      'application/pdf',
    ],
  })

  if (bucketError) {
    if (bucketError.message.includes('already exists')) {
      console.log('  ⏭️  Bucket gr-images already exists')
    } else {
      throw new Error(`Bucket creation failed: ${bucketError.message}`)
    }
  } else {
    console.log('  ✅ Bucket gr-images created')
  }

  console.log('')

  // ── Step 2: Storage RLS policies ────────────────────────
  console.log('🔒 Step 2: Creating storage RLS policies...')

  // Drop old policies first (idempotent)
  const policyNames = [
    'storage_super_admin_select',
    'storage_school_user_select',
    'storage_school_user_insert',
    'storage_school_user_update',
    'storage_school_admin_delete',
  ]

  for (const name of policyNames) {
    await runSQL(
      `DROP POLICY IF EXISTS ${name} ON storage.objects;`,
      `Drop old: ${name}`
    )
  }

  // SELECT: super_admin can read all files in gr-images
  await runSQL(`
    CREATE POLICY storage_super_admin_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'gr-images'
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    );
  `, 'Policy: super_admin can read all')

  // SELECT: school users can read files in their own school folder
  await runSQL(`
    CREATE POLICY storage_school_user_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'gr-images'
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'super_admin'
      AND split_part(name, '/', 1) = (SELECT school_id::text FROM public.profiles WHERE id = auth.uid())
    );
  `, 'Policy: school users read own school files')

  // INSERT: staff and school_admin can upload to their school folder
  await runSQL(`
    CREATE POLICY storage_school_user_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'gr-images'
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('staff', 'school_admin', 'super_admin')
      AND split_part(name, '/', 1) = (SELECT school_id::text FROM public.profiles WHERE id = auth.uid())
    );
  `, 'Policy: staff/admin can upload to own school folder')

  // UPDATE: staff and school_admin can update their school files
  await runSQL(`
    CREATE POLICY storage_school_user_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'gr-images'
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('staff', 'school_admin', 'super_admin')
      AND split_part(name, '/', 1) = (SELECT school_id::text FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
      bucket_id = 'gr-images'
      AND split_part(name, '/', 1) = (SELECT school_id::text FROM public.profiles WHERE id = auth.uid())
    );
  `, 'Policy: staff/admin can update own school files')

  // DELETE: only school_admin can delete files in their school folder
  await runSQL(`
    CREATE POLICY storage_school_admin_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'gr-images'
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('school_admin', 'super_admin')
      AND split_part(name, '/', 1) = (SELECT school_id::text FROM public.profiles WHERE id = auth.uid())
    );
  `, 'Policy: school_admin can delete own school files')

  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('  🎉 Storage setup complete!')
  console.log('═══════════════════════════════════════════════')
  console.log('  Bucket: gr-images (private, 10 MB limit)')
  console.log('  Path structure: {school_id}/{uuid}.{ext}')
  console.log('')

  await sql.end()
}

main().catch(async (err) => {
  console.error('\n❌ Setup failed:', err.message)
  await sql.end()
  process.exit(1)
})
