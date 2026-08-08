/**
 * Shared extraction helpers used by every structured-extraction provider
 * (Gemini vision, Mistral vision, Sarvam text-structuring).
 *
 * Keeping the field list, prompt and JSON→ParsedGRFields mapping in one place
 * means every provider asks for — and returns — the exact same shape, so they
 * can be chained interchangeably as fallbacks.
 */

import type { ParsedGRFields, ParsedField } from './ocr-parser'

// The plain string fields each provider returns per student.
export const STRING_FIELDS: (keyof ParsedGRFields)[] = [
  'gr_number', 'student_name', 'fathers_name', 'mothers_name', 'surname',
  'religion', 'caste_category', 'date_of_birth', 'dob_in_words', 'birth_place',
  'address', 'previous_school', 'admission_date', 'admission_standard',
  'progress_and_conduct', 'leaving_date', 'leaving_reason', 'leaving_standard',
  'remarks',
]

/**
 * Per-field descriptions, keyed off the SAME canonical field list above.
 *
 * These exist so a schema-based extractor (e.g. Sarvam Document AI's `Extract`,
 * which requires a `description` on every schema field) can be generated from the
 * one field contract instead of hand-maintaining a second list that drifts. The
 * wording is the same register domain knowledge encoded in FIELD_SPEC / COLUMN_LAYOUT
 * below, condensed to one line per field, so the schema and the free-text prompts
 * stay consistent.
 */
export const FIELD_DESCRIPTIONS: Record<keyof ParsedGRFields, string> = {
  gr_number:
    'Register number ("રજીસ્ટર નંબર") — the left-most serial/register index of this row, in Western digits. It is NOT a UID / Aadhaar / phone number (those are 9+ digit strings).',
  student_name:
    'The student\'s OWN given name only, in Gujarati. The "પુરૂં નામ" column holds the full name as <given name> <father\'s name> <surname>; return only the first (given) part. Example: "નંદનીબેન ઉપેન્દ્રભાઈ બારોટ" → "નંદનીબેન".',
  fathers_name:
    'Father\'s given name — the MIDDLE part of the full name in the "પુરૂં નામ" column, or a value explicitly labelled "પિતા".',
  mothers_name:
    'Mother\'s name, only when explicitly labelled "માતા" / "માતાનું નામ".',
  surname:
    'Surname / અટક — the LAST part of the full name (e.g. બારોટ, પટેલ, ઠાકોર).',
  religion:
    'Religion, from the "જાત તથા પેટા જાત" column (e.g. હિન્દુ, મુસ્લિમ, ખ્રિસ્તી).',
  caste_category:
    'Caste / sub-caste, from the "જાત તથા પેટા જાત" column (e.g. બારોટ, પટેલ, રજપૂત).',
  date_of_birth:
    'Date of birth from "જન્મ તારીખ (ઇસવીસન પ્રમાણે)", output as YYYY-MM-DD. Register dates are written DAY-first (DD-MM-YYYY), so "06-01-2016" → "2016-01-06".',
  dob_in_words:
    'Date of birth written out in words, if present.',
  birth_place:
    'Birth place ("જન્મભૂમિ"). This column is often OCR-merged with the date; separate them (e.g. "ભુ-ડરોબ 06-01-2016" → birth_place "ભુ-ડરોબ").',
  address:
    'Village / residence (ગામ / રહેઠાણ / વા-).',
  previous_school:
    'Previous school & standard admitted from ("કઇ નિશાળ અને ધોરણમાંથી દાખલ થયા"). If the pupil is new, use "નવો".',
  admission_date:
    'Date of admission to THIS school — the LEFT page column "નિશાળમાં દાખલ થવાની તારીખ", output YYYY-MM-DD. NEVER copy the date of birth here; if the admission column is blank, return "".',
  admission_standard:
    'Standard/class at admission (LEFT page), digits 1-12 only (e.g. "1", "5"). "ધો-5" / "ધોરણ-5" means "5".',
  progress_and_conduct:
    'Progress & conduct notes ("પ્રગતિ અને વર્તન" / "અભ્યાસ / વર્તણૂંક") — RIGHT page.',
  leaving_date:
    'Date the pupil left the school — the RIGHT page column "નિશાળ છોડવાની તારીખ", output YYYY-MM-DD. A date under "છોડવાની તારીખ" is NEVER the admission date.',
  leaving_reason:
    'Reason for leaving ("નિશાળ છોડવાનું કારણ") — RIGHT page.',
  leaving_standard:
    'Standard when leaving ("છોડયા ત્યારે ... ધોરણ") — RIGHT page, digits 1-12 only. It is NEVER the admission standard.',
  remarks:
    'Remarks / શેરો, including the leaving-certificate date & number. Put stray identifiers such as UID / Aadhaar / phone numbers here, not in name fields.',
}

/**
 * Field spec + register domain knowledge shared by every provider.
 *
 * The column semantics matter enormously for accuracy: in a Gujarati GR the
 * "પુરૂં નામ" column holds the full name as <given> <father's> <surname>, and
 * "જાત તથા પેટા જાત" holds <religion> <caste>. Spelling these rules out turns one
 * OCR cell into three correct fields instead of a guess.
 */
const FIELD_SPEC = `Fields to return for each student (ALWAYS include every key; use an empty string "" when the value is not present):
  - gr_number: "રજીસ્ટર નંબર" column — the register number (Western digits)
  - student_name: the student's OWN given name only. The "પુરૂં નામ" column holds the full name in the order <given name> <father's name> <surname>. Example: "નંદનીબેન ઉપેન્દ્રભાઈ બારોટ" → student_name "નંદનીબેન", fathers_name "ઉપેન્દ્રભાઈ", surname "બારોટ".
  - fathers_name: the MIDDLE part of the full name (father's given name), or a "પિતા"-labelled value
  - mothers_name: only when explicitly labelled "માતા" / "માતાનું નામ"
  - surname: the LAST part of the full name (અટક), e.g. બારોટ, પટેલ, ઠાકોર
  - religion: from "જાત તથા પેટા જાત" — the religion part, e.g. હિન્દુ, મુસ્લિમ, ખ્રિસ્તી
  - caste_category: from "જાત તથા પેટા જાત" — the caste/sub-caste part, e.g. બારોટ, પટેલ, રજપૂત
  - date_of_birth: "જન્મ તારીખ (ઇસવીસન પ્રમાણે)" — output YYYY-MM-DD. Register dates are written DD-MM-YYYY, so "06-01-2016" is 2016-01-06.
  - dob_in_words: date of birth written in words, if present
  - birth_place: "જન્મભૂમિ" (birth place). Note this column is often OCR-merged with the date, e.g. "ભુ-ડરોબ 06-01-2016" → birth_place "ભુ-ડરોબ", date_of_birth "2016-01-06".
  - address: village / residence (ગામ / રહેઠાણ / વા-)
  - previous_school: "કઇ નિશાળ અને ધોરણમાંથી દાખલ થયા" — the previous school; if it says the pupil is new (નવો), use "નવો"
  - admission_date: date of admission to THIS school — YYYY-MM-DD
  - admission_standard: standard/class at admission (digits only, e.g. "1", "5")
  - progress_and_conduct: "પ્રગતિ અને વર્તન" notes
  - leaving_date: "નિશાળ છોડવાની તારીખ" — YYYY-MM-DD
  - leaving_reason: "નિશાળ છોડવાનું કારણ"
  - leaving_standard: standard when leaving (digits only; "ધી-5" or "ધો-5" means "5")
  - remarks: "શેરો" / remarks. Put stray identifiers such as UID or phone numbers here, not in name fields.`

/**
 * The physical column order of the official Gujarat GR spread. Without this the
 * model reliably confuses admission dates with leaving dates, because both pages
 * carry a "તારીખ" + "ધોરણ" pair.
 */
const COLUMN_LAYOUT = `Register layout — an open register shows TWO pages side by side:

LEFT page (પત્રક ૪), columns in order:
  1. રજીસ્ટર નંબર            → gr_number
  2. પુરૂં નામ                → student_name + fathers_name + surname (split as described above)
  3. જાત તથા પેટા જાત        → religion + caste_category
  4. જન્મભૂમિ                 → birth_place
  5. જન્મ તારીખ (ઇસવીસન પ્રમાણે) → date_of_birth
  6. કઇ નિશાળ અને ધોરણમાંથી દાખલ થયા → previous_school
  7. નિશાળમાં દાખલ થવાની તારીખ → admission_date
  8. કયા ધોરણ ને કયા વર્ગમાં દાખલ કર્યો → admission_standard

RIGHT page (પત્રક ૫), columns in order — these are all about LEAVING the school
(their headers are often prefixed with "*"):
  9.  નિશાળ છોડવાની તારીખ     → leaving_date
  10. નિશાળ છોડયા ત્યારે કયા ધોરણ ને વર્ગમાં હતો → leaving_standard
  11. અભ્યાસ / વર્તણૂંક        → progress_and_conduct
  12. નિશાળ છોડવાનું કારણ     → leaving_reason
  13. લિવિંગ સર્ટિફીકેટ આપ્યાની તારીખ અને નંબર → remarks

CRITICAL: a date under "છોડવાની તારીખ" is leaving_date, NEVER admission_date, and a
standard under "છોડયા ત્યારે ... ધોરણ" is leaving_standard, NEVER admission_standard.
Only columns 7 and 8 may fill admission_date / admission_standard. If the row has no
value in columns 7-8, leave those fields empty even when other dates exist on the row.
A value like "ધી-5", "ધો-5" or "ધોરણ-5" means the standard is "5".`

const RULES = `Rules — follow these strictly:
  1. NEVER invent, translate or "correct" a name. If you cannot read a value with confidence, return "" for it. An empty field is correct; a guessed field is a serious error.
  2. Copy Gujarati text exactly as written. Convert Gujarati/Devanagari numerals (૦-૯ / ०-९) to Western digits (0-9).
  2a. DATE ORDER: every date in this register is written DAY first — DD/MM/YYYY or DD-MM-YYYY. Convert to YYYY-MM-DD by moving the day to the end. Examples: "06-01-2016" → "2016-01-06"; "08/06 2026" → "2026-06-08"; "8/6 2026" → "2026-06-08". Never read the first number as the month. If a date is missing its year, or is unreadable, return "".
  3. Skip the printed column headers and any blank or "નમુનો" (specimen/sample) row.
  4. Each register row that has its own "રજીસ્ટર નંબર" is a SEPARATE student. Continuation lines with no register number (e.g. a "માતા:" line) belong to the student in the row above.
  5. Return ONLY a JSON object of the form {"students": [ ... ]} — no prose, no markdown fences.
  6. NEVER duplicate a value into a field it does not belong to. In particular: do NOT copy date_of_birth into admission_date. If the admission column is blank — or holds something that is not a date, such as a UID, Aadhaar or phone number — then admission_date must be "".
  7. Long digit strings (9+ digits, e.g. 24170601 or 8082220023) are UID/Aadhaar/phone numbers. They are never a date, a standard or a name: put them in remarks or leave them out.
  8. A standard (ધોરણ) is a small number 1-12. Never output a phone number, year or long digit string as admission_standard or leaving_standard; if unreadable, use "".`

/**
 * Prompt for reading the register image. When `ocrText` is supplied the model is
 * grounded in a real OCR transcription of the same page, which is what stops it
 * hallucinating names: the transcription is the source of truth for spelling and
 * digits, and the image is used only to resolve layout/columns.
 */
export function buildExtractionPrompt(ocrText?: string): string {
  const intro = `You are transcribing a scanned page of a Gujarati school "General Register" (જનરલ રજીસ્ટર / GR) — the handwritten student admission ledger used by primary schools in Gujarat, India. The page is either a multi-row register (one student per numbered row) or a single-student admission page. Extract EVERY student on the page.`

  if (ocrText && ocrText.trim()) {
    return `${intro}

An OCR engine has already transcribed this page. That transcription is your PRIMARY SOURCE OF TRUTH for spellings, names and digits — the image is only to help you understand which value belongs in which column. Do not replace a name from the transcription with a different name. If the transcription and the image disagree on a name, prefer the transcription.

===== OCR TRANSCRIPTION =====
${ocrText.slice(0, 12000)}
===== END TRANSCRIPTION =====

${FIELD_SPEC}

${COLUMN_LAYOUT}

${RULES}`
  }

  return `${intro}

${FIELD_SPEC}

${COLUMN_LAYOUT}

${RULES}`
}

/**
 * Prompt for text-only structuring: no image, just the noisy OCR transcription.
 * Used by providers without vision (Sarvam) as the final structured attempt.
 */
export function buildStructurePrompt(ocrText: string): string {
  return `Below is an OCR transcription of a scanned page from a Gujarati school "General Register" (જનરલ રજીસ્ટર). It may be a markdown table or noisy free text, with mixed Gujarati/Devanagari scripts and fragmented words. Reconstruct the student record(s) from it.

===== OCR TRANSCRIPTION =====
${ocrText.slice(0, 12000)}
===== END TRANSCRIPTION =====

${FIELD_SPEC}

${COLUMN_LAYOUT}

${RULES}`
}

// Retryable transient HTTP statuses (rate limit / server / capacity).
export const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

/**
 * fetch() with a small exponential backoff on transient failures. Providers'
 * free tiers routinely answer 429/503, so a couple of retries keeps a single
 * spike from knocking a provider out of the chain.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, init)
      if (RETRYABLE_STATUS.has(res.status) && attempt < attempts) {
        await new Promise((r) => setTimeout(r, 700 * attempt))
        continue
      }
      return res
    } catch (err) {
      lastError = err
      if (attempt < attempts) {
        await new Promise((r) => setTimeout(r, 700 * attempt))
        continue
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed after retries')
}

function toField(value: unknown, confidence: ParsedField['confidence']): ParsedField | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  if (!v) return undefined
  return { value: v, confidence }
}

const DATE_FIELDS: (keyof ParsedGRFields)[] = ['date_of_birth', 'admission_date', 'leaving_date']
const STANDARD_FIELDS: (keyof ParsedGRFields)[] = ['admission_standard', 'leaving_standard']
const NAME_FIELDS: (keyof ParsedGRFields)[] = ['student_name', 'fathers_name', 'mothers_name', 'surname']

/** True only for a real calendar date in YYYY-MM-DD form. */
function isValidIsoDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/**
 * Deterministic clean-up of whatever a model returned.
 *
 * Prompting reduces bad values but cannot guarantee their absence, so every record
 * passes through these checks. Dropping a doubtful value is deliberate: an empty
 * field prompts the user to fill it in, whereas a plausible-but-wrong value gets
 * silently saved into the permanent record.
 */
function sanitizeRecord(rec: ParsedGRFields): ParsedGRFields {
  // Dates must be real ISO dates.
  for (const f of DATE_FIELDS) {
    const v = rec[f]?.value
    if (v && !isValidIsoDate(v)) delete rec[f]
  }

  // A pupil is never admitted on their date of birth — that pattern means the model
  // copied the DOB across, so the admission date is unknown, not equal to it.
  if (rec.admission_date?.value && rec.admission_date.value === rec.date_of_birth?.value) {
    delete rec.admission_date
  }

  // Leaving cannot precede admission.
  if (rec.admission_date?.value && rec.leaving_date?.value && rec.leaving_date.value < rec.admission_date.value) {
    delete rec.leaving_date
  }

  // A standard is a small number: keep 1-12, else drop. ("ધો-5" → "5")
  for (const f of STANDARD_FIELDS) {
    const v = rec[f]?.value
    if (!v) continue
    const digits = v.match(/\d{1,2}/)
    const n = digits ? Number(digits[0]) : NaN
    if (!digits || Number.isNaN(n) || n < 1 || n > 12) delete rec[f]
    else rec[f] = { value: String(n), confidence: rec[f]!.confidence }
  }

  // Names never contain long digit runs (UID / Aadhaar / phone leaking across).
  for (const f of NAME_FIELDS) {
    const v = rec[f]?.value
    if (v && /\d{5,}/.test(v)) delete rec[f]
  }

  // A GR number is a register index, not an identity number.
  const gr = rec.gr_number?.value
  if (gr && /^\d{9,}$/.test(gr)) delete rec.gr_number

  // Admission-vs-leaving ambiguity: OCR flattens the two-page table, so when a row
  // carries only ONE date/standard pair it cannot be proven which side it came from.
  // Flag those as medium confidence so the UI shows an amber dot and the operator
  // verifies them, rather than presenting a coin-flip as certain.
  const hasAdmissionDate = !!rec.admission_date?.value
  const hasLeavingDate = !!rec.leaving_date?.value
  if (hasAdmissionDate !== hasLeavingDate) {
    for (const f of ['admission_date', 'leaving_date'] as const) {
      if (rec[f]) rec[f] = { value: rec[f]!.value, confidence: 'medium' }
    }
  }
  const hasAdmissionStd = !!rec.admission_standard?.value
  const hasLeavingStd = !!rec.leaving_standard?.value
  if (hasAdmissionStd !== hasLeavingStd) {
    for (const f of STANDARD_FIELDS) {
      if (rec[f]) rec[f] = { value: rec[f]!.value, confidence: 'medium' }
    }
  }

  return rec
}

/**
 * Convert a provider's `students` array into ParsedGRFields[].
 * `confidence` is 'high' for direct vision reads (Gemini/Mistral) and 'medium'
 * for records reconstructed from noisy OCR text (Sarvam).
 */
export function toParsedRecords(
  students: unknown,
  confidence: ParsedField['confidence'] = 'high'
): ParsedGRFields[] {
  const list = Array.isArray(students) ? students : []
  const records: ParsedGRFields[] = []
  for (const s of list) {
    if (!s || typeof s !== 'object') continue
    const src = s as Record<string, unknown>
    const rec: ParsedGRFields = {}
    for (const f of STRING_FIELDS) {
      const field = toField(src[f], confidence)
      if (field) rec[f] = field
    }
    sanitizeRecord(rec)
    // Keep only records that carry at least a name or a GR number — drops empties.
    if (rec.student_name || rec.gr_number) records.push(rec)
  }
  return records
}

/** Pull the JSON `students` array out of a model's parsed JSON, tolerant of shape. */
export function extractStudentsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.students)) return obj.students
    if (Array.isArray(obj.records)) return obj.records
    if (Array.isArray(obj.data)) return obj.data
  }
  return []
}
