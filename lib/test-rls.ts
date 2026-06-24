/**
 * Phase 2 — RLS Tenant Isolation Test Script
 * 
 * Tests the Row Level Security policies by logging in as different
 * test users and verifying they can only see/modify their own school's data.
 * 
 * USAGE:
 *   1. Fill in the credentials below (same passwords you set in Supabase Auth)
 *   2. Run:  npx tsx lib/test-rls.ts
 *   
 *   Requires: npm install tsx (dev dependency, one-time)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ⚠️ FILL IN the passwords you used when creating test users
const TEST_USERS = {
  super_admin:   { email: 'super@test.com',        password: 'REPLACE_ME' },
  admin_a:       { email: 'admin-a@test.com',       password: 'REPLACE_ME' },
  staff_a:       { email: 'staff-a@test.com',       password: 'REPLACE_ME' },
  principal_a:   { email: 'principal-a@test.com',    password: 'REPLACE_ME' },
  admin_b:       { email: 'admin-b@test.com',        password: 'REPLACE_ME' },
  staff_b:       { email: 'staff-b@test.com',        password: 'REPLACE_ME' },
  principal_b:   { email: 'principal-b@test.com',     password: 'REPLACE_ME' },
}

// ────────────────────────────────────────────────────────────

interface TestResult {
  test: string
  passed: boolean
  detail: string
}

const results: TestResult[] = []

function pass(test: string, detail: string) {
  results.push({ test, passed: true, detail })
  console.log(`  ✅ ${test}: ${detail}`)
}

function fail(test: string, detail: string) {
  results.push({ test, passed: false, detail })
  console.log(`  ❌ ${test}: ${detail}`)
}

async function loginAs(label: string, email: string, password: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`Failed to log in as ${label} (${email}): ${error?.message}`)
  }
  console.log(`\n🔑 Logged in as: ${label} (${email})`)
  return client
}

// ────────────────────────────────────────────────────────────
// TEST 1: Staff A can see School A records, NOT School B
// ────────────────────────────────────────────────────────────
async function testStaffAIsolation() {
  const client = await loginAs('Staff A', TEST_USERS.staff_a.email, TEST_USERS.staff_a.password)

  const { data, error } = await client.from('gr_records').select('*')
  if (error) { fail('Staff A - read records', error.message); return }

  const schoolIds = [...new Set(data.map((r: { school_id: string }) => r.school_id))]

  if (data.length > 0 && schoolIds.every(id => id === 'a0000000-0000-0000-0000-000000000001')) {
    pass('Staff A - read records', `Sees ${data.length} record(s), all School A only`)
  } else if (data.length === 0) {
    fail('Staff A - read records', 'No records returned — check seed data')
  } else {
    fail('Staff A - read records', `CROSS-TENANT LEAK! Saw school_ids: ${schoolIds.join(', ')}`)
  }
}

// ────────────────────────────────────────────────────────────
// TEST 2: Principal A cannot INSERT a record
// ────────────────────────────────────────────────────────────
async function testPrincipalACannotInsert() {
  const client = await loginAs('Principal A', TEST_USERS.principal_a.email, TEST_USERS.principal_a.password)

  const { error } = await client.from('gr_records').insert({
    school_id: 'a0000000-0000-0000-0000-000000000001',
    gr_number: 'GR-999',
    student_name: 'Should Not Exist',
    fathers_name: 'Test',
    surname: 'Test',
    date_of_birth: '2010-01-01',
    admission_date: '2020-01-01',
  })

  if (error) {
    pass('Principal A - insert blocked', `Correctly rejected: ${error.message}`)
  } else {
    fail('Principal A - insert blocked', 'INSERT SUCCEEDED — principal should NOT be able to insert!')
  }
}

// ────────────────────────────────────────────────────────────
// TEST 3: Super Admin can see ALL schools' records
// ────────────────────────────────────────────────────────────
async function testSuperAdminSeesAll() {
  const client = await loginAs('Super Admin', TEST_USERS.super_admin.email, TEST_USERS.super_admin.password)

  const { data, error } = await client.from('gr_records').select('*')
  if (error) { fail('Super Admin - read all', error.message); return }

  const schoolIds = [...new Set(data.map((r: { school_id: string }) => r.school_id))]

  if (schoolIds.length >= 2) {
    pass('Super Admin - read all', `Sees records from ${schoolIds.length} schools: ${schoolIds.join(', ')}`)
  } else {
    fail('Super Admin - read all', `Only sees ${schoolIds.length} school(s) — expected at least 2`)
  }
}

// ────────────────────────────────────────────────────────────
// TEST 4: Staff B cannot see School A data
// ────────────────────────────────────────────────────────────
async function testStaffBIsolation() {
  const client = await loginAs('Staff B', TEST_USERS.staff_b.email, TEST_USERS.staff_b.password)

  const { data, error } = await client.from('gr_records').select('*')
  if (error) { fail('Staff B - read records', error.message); return }

  const schoolIds = [...new Set(data.map((r: { school_id: string }) => r.school_id))]

  if (data.length > 0 && schoolIds.every(id => id === 'b0000000-0000-0000-0000-000000000002')) {
    pass('Staff B - read records', `Sees ${data.length} record(s), all School B only`)
  } else if (data.length === 0) {
    fail('Staff B - read records', 'No records returned — check seed data')
  } else {
    fail('Staff B - read records', `CROSS-TENANT LEAK! Saw school_ids: ${schoolIds.join(', ')}`)
  }
}

// ────────────────────────────────────────────────────────────
// RUN ALL TESTS
// ────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  Phase 2 — RLS Tenant Isolation Tests')
  console.log('═══════════════════════════════════════════════')

  await testStaffAIsolation()
  await testPrincipalACannotInsert()
  await testSuperAdminSeesAll()
  await testStaffBIsolation()

  console.log('\n═══════════════════════════════════════════════')
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  console.log(`  Results: ${passed} passed, ${failed} failed out of ${results.length} tests`)
  console.log('═══════════════════════════════════════════════')

  if (failed > 0) {
    console.log('\n⚠️  SOME TESTS FAILED — do NOT proceed to Phase 3 until fixed.\n')
    process.exit(1)
  } else {
    console.log('\n🎉  All tests passed — tenant isolation verified. Safe to proceed to Phase 3.\n')
  }
}

main()
