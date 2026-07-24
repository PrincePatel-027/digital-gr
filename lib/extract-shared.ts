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

// Vision prompt — used by the image-reading providers (Gemini, Mistral).
export const EXTRACTION_PROMPT = `You are reading a scanned page from a Gujarati school "General Register" (જનરલ રજિસ્ટર / GR) — the handwritten student admission ledger used by primary schools in Gujarat, India.

The page may be EITHER:
  (a) a multi-row register where each numbered row is a different student, OR
  (b) a single-student detailed admission page.

Extract EVERY student on the page. For each student return these fields (use an empty string "" when a field is not present — never guess):
  - gr_number: register/GR number (digits only if possible)
  - student_name: વિદ્યાર્થીનું નામ (given name), in Gujarati as written
  - fathers_name: પિતાનું નામ
  - mothers_name: માતાનું નામ
  - surname: અટક
  - religion: ધર્મ (e.g. હિંદુ, મુસ્લિમ, ખ્રિસ્તી)
  - caste_category: જ્ઞાતિ / જાત (e.g. પટેલ, રજપૂત, ઠાકોર)
  - date_of_birth: જન્મ તારીખ — normalize to YYYY-MM-DD (register dates are 1900s; a 2-digit year like 32 means 1932)
  - dob_in_words: જન્મ તારીખ શબ્દોમાં
  - birth_place: જન્મ સ્થળ
  - address: ગામ / રહેઠાણ
  - previous_school: છેલ્લી શાળા
  - admission_date: દાખલ થયા તારીખ — YYYY-MM-DD
  - admission_standard: દાખલ થયા ધોરણ
  - progress_and_conduct: પ્રગતિ અને વર્તન
  - leaving_date: શાળા છોડ્યા તારીખ — YYYY-MM-DD
  - leaving_reason: છોડવાનું કારણ
  - leaving_standard: છોડતી વખતે ધોરણ
  - remarks: રીમાર્ક્સ / શેરો

Preserve Gujarati text exactly as written; convert Gujarati/Devanagari numerals to Western digits. Ignore printed column headers and the "નમુનો" (sample) row. Return ONLY a JSON object of the form {"students": [ ... ]} where each element has the fields listed above as string values.`

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
