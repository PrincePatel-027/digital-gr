/**
 * Phase 2 — Automated Setup Script
 *
 * Creates tables, auth users, profiles, seed data, and RLS policies.
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_DB_URL
 *
 * Usage:  npx tsx lib/setup-phase2.ts
 */

import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import * as fs from 'fs'
import * as path from 'path'

// ── Load .env.local manually ──────────────────────────────────
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found')
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
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

if (!SUPABASE_URL) { console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL'); process.exit(1) }
if (!SERVICE_ROLE_KEY) { console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
if (!DB_PASSWORD) { console.error('❌ Missing SUPABASE_DB_PASSWORD'); process.exit(1) }

// Extract project ref from URL (e.g., "https://fgumchlpvvpspolushge.supabase.co" → "fgumchlpvvpspolushge")
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
// Use the direct database host (not pooler — more reliable for DDL)
const DB_URL = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${projectRef}.supabase.co:5432/postgres`



// Postgres direct connection
const sql = postgres(DB_URL, { ssl: 'require', connect_timeout: 15 })

// Supabase admin client (for auth user creation)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helper: run SQL with label ────────────────────────────────
async function runSQL(query: string, label: string) {
  try {
    await sql.unsafe(query)
    console.log(`  ✅ ${label}`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Ignore "already exists" type errors for idempotency
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`  ⏭️  ${label} (already exists)`)
    } else {
      throw new Error(`${label}: ${msg}`)
    }
  }
}

// ── Test users ────────────────────────────────────────────────
const TEST_PASSWORD = 'TestPass123!'

const TEST_USERS = [
  { email: 'super@test.com',       role: 'super_admin',  school: null, name: 'Super Admin' },
  { email: 'admin-a@test.com',     role: 'school_admin', school: 'A',  name: 'Admin School A' },
  { email: 'staff-a@test.com',     role: 'staff',        school: 'A',  name: 'Staff School A' },
  { email: 'principal-a@test.com', role: 'principal',    school: 'A',  name: 'Principal School A' },
  { email: 'admin-b@test.com',     role: 'school_admin', school: 'B',  name: 'Admin School B' },
  { email: 'staff-b@test.com',     role: 'staff',        school: 'B',  name: 'Staff School B' },
  { email: 'principal-b@test.com', role: 'principal',    school: 'B',  name: 'Principal School B' },
] as const

const SCHOOL_IDS = {
  A: 'a0000000-0000-0000-0000-000000000001',
  B: 'b0000000-0000-0000-0000-000000000002',
} as const

// ══════════════════════════════════════════════════════════════
async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 2 — Automated Database Setup')
  console.log('═══════════════════════════════════════════════')
  console.log(`  Supabase: ${SUPABASE_URL}`)
  console.log('')

  // ── Step 1: Core tables ─────────────────────────────────
  console.log('📦 Step 1: Creating core tables...')

  await runSQL(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`, 'Enable pgcrypto')

  await runSQL(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('super_admin', 'school_admin', 'staff', 'principal');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `, 'Create user_role enum')

  await runSQL(`
    CREATE TABLE IF NOT EXISTS schools (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name          TEXT NOT NULL,
      address       TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `, 'Create schools table')

  await runSQL(`
    CREATE TABLE IF NOT EXISTS profiles (
      id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      school_id  UUID REFERENCES schools(id) ON DELETE SET NULL,
      role       user_role NOT NULL DEFAULT 'staff',
      full_name  TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `, 'Create profiles table')

  await runSQL(`CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles(school_id);`, 'Index: profiles.school_id')

  await runSQL(`
    CREATE TABLE IF NOT EXISTS gr_records (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      gr_number       TEXT NOT NULL,
      student_name    TEXT NOT NULL,
      fathers_name    TEXT NOT NULL,
      mothers_name    TEXT,
      surname         TEXT NOT NULL,
      date_of_birth   DATE NOT NULL,
      admission_date  DATE NOT NULL,
      address         TEXT,
      caste_category  TEXT,
      previous_school TEXT,
      image_url       TEXT,
      ocr_raw_text    TEXT,
      created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `, 'Create gr_records table')

  await runSQL(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gr_records_school_gr_number ON gr_records(school_id, gr_number);`, 'Unique index: school_id + gr_number')
  await runSQL(`CREATE INDEX IF NOT EXISTS idx_gr_records_school_id ON gr_records(school_id);`, 'Index: gr_records.school_id')
  await runSQL(`CREATE INDEX IF NOT EXISTS idx_gr_records_student_name ON gr_records(school_id, student_name);`, 'Index: student_name')
  await runSQL(`CREATE INDEX IF NOT EXISTS idx_gr_records_surname ON gr_records(school_id, surname);`, 'Index: surname')

  await runSQL(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
  `, 'Create updated_at trigger function')

  await runSQL(`
    DROP TRIGGER IF EXISTS trg_gr_records_updated_at ON gr_records;
    CREATE TRIGGER trg_gr_records_updated_at BEFORE UPDATE ON gr_records
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `, 'Create updated_at trigger')

  console.log('')

  // ── Step 2: Insert test schools ─────────────────────────
  console.log('🏫 Step 2: Creating test schools...')

  await runSQL(`
    INSERT INTO schools (id, name, address, contact_phone, contact_email) VALUES
      ('${SCHOOL_IDS.A}', 'Test School A', '123 Main St, City A', '9876543210', 'schoola@test.com'),
      ('${SCHOOL_IDS.B}', 'Test School B', '456 Oak Ave, City B', '9876543211', 'schoolb@test.com')
    ON CONFLICT (id) DO NOTHING;
  `, 'Insert School A and School B')

  console.log('')

  // ── Step 3: Create auth users ───────────────────────────
  console.log('👤 Step 3: Creating 7 test auth users...')

  const userIdMap: Record<string, string> = {}

  for (const user of TEST_USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })

    if (error) {
      if (error.message.includes('already been registered') || error.message.includes('already exists')) {
        // Find existing user
        const { data: listData } = await supabase.auth.admin.listUsers()
        const existing = listData?.users?.find((u) => u.email === user.email)
        if (existing) {
          userIdMap[user.email] = existing.id
          console.log(`  ⏭️  ${user.email} (already exists → ${existing.id.slice(0, 8)}…)`)
          continue
        }
        throw new Error(`User ${user.email} exists but couldn't be found`)
      }
      throw new Error(`Failed to create ${user.email}: ${error.message}`)
    }

    userIdMap[user.email] = data.user.id
    console.log(`  ✅ ${user.email} → ${data.user.id.slice(0, 8)}…`)
  }

  console.log('')

  // ── Step 4: Create profiles ─────────────────────────────
  console.log('📝 Step 4: Creating profiles...')

  for (const user of TEST_USERS) {
    const uid = userIdMap[user.email]
    const schoolId = user.school ? SCHOOL_IDS[user.school] : null

    await runSQL(`
      INSERT INTO profiles (id, school_id, role, full_name) VALUES
        ('${uid}', ${schoolId ? `'${schoolId}'` : 'NULL'}, '${user.role}', '${user.name}')
      ON CONFLICT (id) DO UPDATE SET school_id = EXCLUDED.school_id, role = EXCLUDED.role, full_name = EXCLUDED.full_name;
    `, `${user.name} (${user.role})`)
  }

  console.log('')

  // ── Step 5: Sample GR records ───────────────────────────
  console.log('📄 Step 5: Inserting sample GR records...')

  await runSQL(`
    INSERT INTO gr_records (school_id, gr_number, student_name, fathers_name, surname, date_of_birth, admission_date, created_by) VALUES
      ('${SCHOOL_IDS.A}', 'GR-001', 'Rahul', 'Suresh', 'Patel', '2015-03-15', '2021-06-01', '${userIdMap['staff-a@test.com']}'),
      ('${SCHOOL_IDS.B}', 'GR-001', 'Priya', 'Rajesh', 'Sharma', '2014-07-22', '2020-06-01', '${userIdMap['staff-b@test.com']}')
    ON CONFLICT (school_id, gr_number) DO NOTHING;
  `, 'GR-001 in both schools')

  console.log('')

  // ── Step 6: RLS policies ────────────────────────────────
  console.log('🔒 Step 6: Setting up Row Level Security...')

  await runSQL(`
    CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS user_role AS $$
      SELECT role FROM public.profiles WHERE id = auth.uid();
    $$ LANGUAGE sql SECURITY DEFINER STABLE;
  `, 'Function: get_my_role()')

  await runSQL(`
    CREATE OR REPLACE FUNCTION public.get_my_school_id() RETURNS UUID AS $$
      SELECT school_id FROM public.profiles WHERE id = auth.uid();
    $$ LANGUAGE sql SECURITY DEFINER STABLE;
  `, 'Function: get_my_school_id()')

  await runSQL(`ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;`, 'Enable RLS: profiles')
  await runSQL(`ALTER TABLE gr_records ENABLE ROW LEVEL SECURITY;`, 'Enable RLS: gr_records')

  // Drop + recreate policies (idempotent)
  const policies = [
    { table: 'profiles', name: 'profiles_super_admin_all', sql: `CREATE POLICY profiles_super_admin_all ON profiles FOR ALL USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');` },
    { table: 'profiles', name: 'profiles_select_own_school', sql: `CREATE POLICY profiles_select_own_school ON profiles FOR SELECT USING (school_id = get_my_school_id() OR id = auth.uid());` },
    { table: 'profiles', name: 'profiles_school_admin_insert', sql: `CREATE POLICY profiles_school_admin_insert ON profiles FOR INSERT WITH CHECK (get_my_role() = 'school_admin' AND school_id = get_my_school_id() AND school_id IS NOT NULL);` },
    { table: 'profiles', name: 'profiles_school_admin_update', sql: `CREATE POLICY profiles_school_admin_update ON profiles FOR UPDATE USING (get_my_role() = 'school_admin' AND school_id = get_my_school_id()) WITH CHECK (get_my_role() = 'school_admin' AND school_id = get_my_school_id());` },
    { table: 'profiles', name: 'profiles_school_admin_delete', sql: `CREATE POLICY profiles_school_admin_delete ON profiles FOR DELETE USING (get_my_role() = 'school_admin' AND school_id = get_my_school_id() AND id != auth.uid());` },
    { table: 'gr_records', name: 'gr_records_super_admin_all', sql: `CREATE POLICY gr_records_super_admin_all ON gr_records FOR ALL USING (get_my_role() = 'super_admin') WITH CHECK (get_my_role() = 'super_admin');` },
    { table: 'gr_records', name: 'gr_records_select_own_school', sql: `CREATE POLICY gr_records_select_own_school ON gr_records FOR SELECT USING (school_id = get_my_school_id());` },
    { table: 'gr_records', name: 'gr_records_insert_own_school', sql: `CREATE POLICY gr_records_insert_own_school ON gr_records FOR INSERT WITH CHECK (get_my_role() IN ('staff', 'school_admin') AND school_id = get_my_school_id());` },
    { table: 'gr_records', name: 'gr_records_update_own_school', sql: `CREATE POLICY gr_records_update_own_school ON gr_records FOR UPDATE USING (get_my_role() IN ('staff', 'school_admin') AND school_id = get_my_school_id()) WITH CHECK (get_my_role() IN ('staff', 'school_admin') AND school_id = get_my_school_id());` },
    { table: 'gr_records', name: 'gr_records_delete_own_school', sql: `CREATE POLICY gr_records_delete_own_school ON gr_records FOR DELETE USING (get_my_role() = 'school_admin' AND school_id = get_my_school_id());` },
  ]

  for (const p of policies) {
    await runSQL(`DROP POLICY IF EXISTS ${p.name} ON ${p.table};`, `Drop: ${p.name}`)
    await runSQL(p.sql, `Create: ${p.name}`)
  }

  console.log('')

  // ── Done ────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════')
  console.log('  🎉 Phase 2 Setup Complete!')
  console.log('═══════════════════════════════════════════════')
  console.log('')
  console.log('  Created:')
  console.log('     • 3 tables (schools, profiles, gr_records)')
  console.log('     • 2 test schools (A and B)')
  console.log('     • 7 auth users + 7 profiles')
  console.log('     • 2 sample GR records')
  console.log('     • 10 RLS policies + 2 helper functions')
  console.log('')
  console.log(`  🔑 All test users share password: ${TEST_PASSWORD}`)
  console.log('')
  console.log('  Accounts:')
  for (const user of TEST_USERS) {
    const schoolLabel = user.school ? `School ${user.school}` : 'All schools'
    console.log(`     ${user.email.padEnd(25)} ${user.role.padEnd(14)} ${schoolLabel}`)
  }
  console.log('')

  await sql.end()
}

main().catch(async (err) => {
  console.error('\n❌ Setup failed:', err.message)
  await sql.end()
  process.exit(1)
})
