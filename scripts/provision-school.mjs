/**
 * Provision / repair a school tenant.
 *
 * Creates a school (if it doesn't already exist by name) and attaches an existing
 * login to it as school_admin. This exists because the UI can create schools and
 * users, but cannot MOVE an existing user from one school to another — which is how
 * an account ends up showing the wrong school.
 *
 * Runs server-side with the service role key, so it bypasses RLS by design.
 *
 * Usage:
 *   node scripts/provision-school.mjs --school "Manekrao School" --admin manekrao@school.com
 *
 * Options:
 *   --school <name>    Name of the school (created if missing, matched if present)
 *   --admin <email>    Existing login to attach to that school as school_admin
 *   --role <role>      Role for that login (default: school_admin)
 *   --address <text>   Optional school address
 *   --phone <text>     Optional contact phone
 *   --email <text>     Optional contact email
 *   --move-records     Also move gr_records CREATED BY that user to the new school
 *   --dry-run          Show what would change without writing anything
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── args ──────────────────────────────────────────────────────
const argv = process.argv.slice(2)
function arg(name, fallback = null) {
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const flag = (name) => argv.includes(`--${name}`)

const schoolName = arg('school')
const adminEmail = arg('admin')
const role = arg('role', 'school_admin')
const dryRun = flag('dry-run')
const moveRecords = flag('move-records')

if (!schoolName) {
  console.error('Missing --school "<name>". See the usage comment at the top of this file.')
  process.exit(1)
}
if (!['school_admin', 'staff', 'principal'].includes(role)) {
  console.error(`Invalid --role "${role}". Use school_admin, staff or principal.`)
  process.exit(1)
}

// ── env ───────────────────────────────────────────────────────
const env = {}
const envPath = path.join(process.cwd(), '.env.local')
if (!fs.existsSync(envPath)) {
  console.error('.env.local not found — run this from the project root.')
  process.exit(1)
}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

if (dryRun) console.log('DRY RUN — nothing will be written.\n')

// ── 1. find or create the school ──────────────────────────────
const { data: existing, error: findErr } = await admin
  .from('schools')
  .select('id, name')
  .eq('name', schoolName)
  .maybeSingle()

if (findErr) {
  console.error(`Could not query schools: ${findErr.message}`)
  process.exit(1)
}

let schoolId = existing?.id
if (existing) {
  console.log(`School already exists: "${existing.name}" (${existing.id})`)
} else if (dryRun) {
  console.log(`Would CREATE school "${schoolName}"`)
} else {
  const { data: created, error: createErr } = await admin
    .from('schools')
    .insert({
      name: schoolName,
      address: arg('address'),
      contact_phone: arg('phone'),
      contact_email: arg('email'),
    })
    .select('id')
    .single()
  if (createErr) {
    console.error(`Failed to create school: ${createErr.message}`)
    process.exit(1)
  }
  schoolId = created.id
  console.log(`Created school "${schoolName}" (${schoolId})`)
}

// ── 2. attach the login to that school ────────────────────────
if (adminEmail) {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 500 })
  if (listErr) {
    console.error(`Could not list auth users: ${listErr.message}`)
    process.exit(1)
  }
  const user = (list?.users || []).find((u) => u.email?.toLowerCase() === adminEmail.toLowerCase())
  if (!user) {
    console.error(`No login found for ${adminEmail}. Create the user first, then re-run.`)
    process.exit(1)
  }

  const { data: prof } = await admin
    .from('profiles')
    .select('id, school_id, role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: oldSchool } = prof?.school_id
    ? await admin.from('schools').select('name').eq('id', prof.school_id).maybeSingle()
    : { data: null }

  console.log(
    `\n${adminEmail}\n  current: school="${oldSchool?.name ?? '(none)'}" role="${prof?.role ?? '(no profile)'}"` +
    `\n  target:  school="${schoolName}" role="${role}"`
  )

  if (!dryRun) {
    if (prof) {
      const { error: upErr } = await admin
        .from('profiles')
        .update({ school_id: schoolId, role })
        .eq('id', user.id)
      if (upErr) {
        console.error(`Failed to update profile: ${upErr.message}`)
        process.exit(1)
      }
      console.log('  → profile updated')
    } else {
      const { error: insErr } = await admin.from('profiles').insert({
        id: user.id,
        school_id: schoolId,
        role,
        full_name: user.email.split('@')[0],
        is_active: true,
      })
      if (insErr) {
        console.error(`Failed to create profile: ${insErr.message}`)
        process.exit(1)
      }
      console.log('  → profile created')
    }
  }

  // ── 3. optionally move records this user created ────────────
  if (moveRecords) {
    const { data: theirs } = await admin
      .from('gr_records')
      .select('id, gr_number, student_name, school_id')
      .eq('created_by', user.id)
    const toMove = (theirs || []).filter((r) => r.school_id !== schoolId)
    console.log(`\nRecords created by this user in another school: ${toMove.length}`)
    for (const r of toMove) console.log(`  GR ${r.gr_number} — ${r.student_name}`)
    if (toMove.length && !dryRun) {
      const { error: mvErr } = await admin
        .from('gr_records')
        .update({ school_id: schoolId })
        .in('id', toMove.map((r) => r.id))
      if (mvErr) console.error(`Failed to move records: ${mvErr.message}`)
      else console.log(`  → moved ${toMove.length} record(s) to "${schoolName}"`)
    }
  }
}

console.log(dryRun ? '\nDry run complete — no changes made.' : '\nDone.')
