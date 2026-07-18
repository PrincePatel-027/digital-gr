/**
 * Gemini Extraction Module — Google Gemini (vision) structured GR extraction
 *
 * Uses the FREE Google AI Studio tier (get a key at https://aistudio.google.com/apikey).
 * Unlike OCR.space (raw OCR → fragile regex parser), Gemini reads the register
 * image directly and returns structured student records as JSON — so it works on
 * BOTH the multi-row register layout and single-student detail pages, and is far
 * more accurate on handwritten Gujarati.
 *
 * Set GEMINI_API_KEY in .env.local to enable. Optional GEMINI_MODEL overrides the
 * default model id.
 */

import sharp from 'sharp'
import type { ParsedGRFields, ParsedField } from './ocr-parser'

const DEFAULT_MODEL = 'gemini-2.5-flash'

export interface GeminiExtractResult {
  records: ParsedGRFields[]
  mode: 'gemini'
  raw: string
  error?: string
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}

// The plain string fields we ask Gemini to return per student.
const STRING_FIELDS: (keyof ParsedGRFields)[] = [
  'gr_number', 'student_name', 'fathers_name', 'mothers_name', 'surname',
  'religion', 'caste_category', 'date_of_birth', 'dob_in_words', 'birth_place',
  'address', 'previous_school', 'admission_date', 'admission_standard',
  'progress_and_conduct', 'leaving_date', 'leaving_reason', 'leaving_standard',
  'remarks',
]

// Gemini structured-output schema: an object with a `students` array.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    students: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: Object.fromEntries(STRING_FIELDS.map((f) => [f, { type: 'STRING' }])),
      },
    },
  },
  required: ['students'],
}

const PROMPT = `You are reading a scanned page from a Gujarati school "General Register" (જનરલ રજિસ્ટર / GR) — the handwritten student admission ledger used by primary schools in Gujarat, India.

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

Preserve Gujarati text exactly as written; convert Gujarati/Devanagari numerals to Western digits. Ignore printed column headers and the "નમુનો" (sample) row. Return ONLY the JSON object described by the schema.`

function toField(value: unknown): ParsedField | undefined {
  if (typeof value !== 'string') return undefined
  const v = value.trim()
  if (!v) return undefined
  return { value: v, confidence: 'high' }
}

function toParsedRecords(students: Record<string, unknown>[]): ParsedGRFields[] {
  const records: ParsedGRFields[] = []
  for (const s of students) {
    const rec: ParsedGRFields = {}
    for (const f of STRING_FIELDS) {
      const field = toField(s[f])
      if (field) rec[f] = field
    }
    // Keep only records that carry at least a name or a GR number — drops empties.
    if (rec.student_name || rec.gr_number) records.push(rec)
  }
  return records
}

export async function extractGRRecords(imageBuffer: Buffer): Promise<GeminiExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { records: [], mode: 'gemini', raw: '', error: 'GEMINI_API_KEY not configured' }
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  try {
    // Normalize to JPEG + auto-orient (handles PNG/WebP/EXIF rotation) so Gemini gets a clean image.
    const jpeg = await sharp(imageBuffer).rotate().jpeg({ quality: 92 }).toBuffer()
    const base64 = jpeg.toString('base64')

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: base64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { records: [], mode: 'gemini', raw: '', error: `Gemini returned ${res.status}: ${errText.slice(0, 300)}` }
    }

    const data = await res.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason || 'no content'
      return { records: [], mode: 'gemini', raw: JSON.stringify(data).slice(0, 300), error: `Gemini returned no text (${reason})` }
    }

    let parsed: { students?: Record<string, unknown>[] }
    try {
      parsed = JSON.parse(text)
    } catch {
      return { records: [], mode: 'gemini', raw: text, error: 'Gemini response was not valid JSON' }
    }

    const records = toParsedRecords(parsed.students || [])
    return { records, mode: 'gemini', raw: text }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { records: [], mode: 'gemini', raw: '', error: `Gemini extraction failed: ${message}` }
  }
}
