/**
 * Verify tenant isolation end-to-end.
 *
 * Signs in with the PUBLIC anon key (exactly like the browser) and reports what each
 * user can actually read. Confirms both that RLS blocks cross-school reads AND that
 * each user can still resolve their OWN school name (which the dashboard header needs).
 *
 * Usage: node scripts/verify-tenancy.mjs [email] [password]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log('========== GROUND TRUTH (service role) ==========')
const { data: schools } = await admin.from('schools').select('id, name').order('created_at')
const { data: profiles } = await admin.from('profiles').select('id, school_id, role')
const { data: records } = await admin.from('gr_records').select('id, school_id')
const { data: authList } = await admin.auth.admin.listUsers({ perPage: 500 })
const emailById = new Map((authList?.users || []).map((u) => [u.id, u.email]))

for (const s of schools || []) {
  const us = (profiles || []).filter((p) => p.school_id === s.id)
  const rs = (records || []).filter((r) => r.school_id === s.id)
  console.log(`\n${s.name}  (users: ${us.length}, records: ${rs.length})`)
  for (const u of us) console.log(`    ${emailById.get(u.id)}  [${u.role}]`)
}

async function asUser(email, password) {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { error } = await c.auth.signInWithPassword({ email, password })
  console.log(`\n========== as ${email} ==========`)
  if (error) {
    console.log(`  sign-in failed: ${error.message}`)
    return
  }
  const uid = (await c.auth.getUser()).data.user.id
  const { data: prof } = await c
    .from('profiles')
    .select('role, full_name, school_id, schools(name)')
    .eq('id', uid)
    .single()
  console.log(`  role=${prof?.role}`)
  console.log(`  own school name resolves: ${prof?.schools?.name ? `YES → "${prof.schools.name}"` : 'NO  ← dashboard header would be blank'}`)

  const { data: sc } = await c.from('schools').select('name')
  console.log(`  schools visible: ${sc?.length ?? 0} → ${(sc || []).map((s) => s.name).join(', ') || '(none)'}`)

  const { data: rc } = await c.from('gr_records').select('id, school_id')
  const foreign = (rc || []).filter((r) => prof?.school_id && r.school_id !== prof.school_id)
  console.log(`  records visible: ${rc?.length ?? 0}${foreign.length ? `  ⚠ ${foreign.length} FROM ANOTHER SCHOOL` : ''}`)

  const { data: pf } = await c.from('profiles').select('id, school_id')
  const foreignP = (pf || []).filter((p) => prof?.school_id && p.school_id !== prof.school_id)
  console.log(`  profiles visible: ${pf?.length ?? 0}${foreignP.length ? `  ⚠ ${foreignP.length} FROM ANOTHER SCHOOL` : ''}`)

  await c.auth.signOut()
}

await asUser('admin-b@test.com', 'TestPass123!')
await asUser('admin-a@test.com', 'TestPass123!')
await asUser('super@test.com', 'TestPass123!')

if (process.argv[2] && process.argv[3]) {
  await asUser(process.argv[2], process.argv[3])
}
