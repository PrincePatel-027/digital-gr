import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  const env = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadLocalEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const password = env.SUPABASE_DB_PASSWORD
if (!url || !password) {
  throw new Error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local')
}

const projectRef = new URL(url).hostname.split('.')[0]
const database = postgres(
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`,
  { ssl: 'require', connect_timeout: 20, max: 1, prepare: false }
)

const rollbackMarker = '__ROLLBACK_LOCATION_SMOKE__'
const marker = `__location_smoke_${Date.now()}`
let roundTrip = false

try {
  const columns = await database`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'gr_records'
      AND column_name IN (
        'previous_school_district',
        'previous_school_subdistrict',
        'fields_en'
      )
    ORDER BY column_name
  `
  const expectedTypes = new Map([
    ['fields_en', 'jsonb'],
    ['previous_school_district', 'text'],
    ['previous_school_subdistrict', 'text'],
  ])
  const columnsValid = columns.length === expectedTypes.size && columns.every((column) => (
    expectedTypes.get(column.column_name) === column.data_type && column.is_nullable === 'YES'
  ))
  if (!columnsValid) throw new Error('The three nullable columns do not match the expected schema.')

  const [existing] = await database`
    SELECT id
    FROM public.gr_records
    ORDER BY created_at ASC
    LIMIT 1
  `
  if (!existing?.id) {
    throw new Error('No existing GR record is available for the regression check.')
  }

  try {
    await database.begin(async (transaction) => {
      const [row] = await transaction`
        INSERT INTO public.gr_records (
          school_id,
          gr_number,
          student_name,
          fathers_name,
          surname,
          date_of_birth,
          admission_date,
          previous_school_district,
          previous_school_subdistrict,
          fields_en
        )
        SELECT
          school_id,
          ${marker},
          'Schema Smoke',
          'Parent Smoke',
          'Test',
          '2010-01-01',
          '2015-06-01',
          'vadodara',
          'vadodara',
          ${transaction.json({
            student_name: { value: 'Schema Smoke', source: 'human' },
          })}
        FROM public.gr_records
        ORDER BY created_at ASC
        LIMIT 1
        RETURNING
          previous_school_district,
          previous_school_subdistrict,
          fields_en
      `

      roundTrip = row?.previous_school_district === 'vadodara' &&
        row?.previous_school_subdistrict === 'vadodara' &&
        row?.fields_en?.student_name?.value === 'Schema Smoke' &&
        row?.fields_en?.student_name?.source === 'human'

      throw new Error(rollbackMarker)
    })
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) throw error
  }

  const [residue] = await database`
    SELECT count(*)::int AS count
    FROM public.gr_records
    WHERE gr_number = ${marker}
  `
  const transactionRolledBack = residue.count === 0
  if (!roundTrip || !transactionRolledBack) {
    throw new Error('Synthetic insert did not round-trip cleanly or was not rolled back.')
  }

  console.log(JSON.stringify({
    columns_nullable: true,
    existing_record_loaded: true,
    manual_insert_round_trip: true,
    transaction_rolled_back: true,
  }))
} finally {
  await database.end()
}
