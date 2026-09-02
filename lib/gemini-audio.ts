import 'server-only'

import {
  FIELD_DESCRIPTIONS,
  STRING_FIELDS,
  fetchWithRetry,
  toParsedRecord,
} from './extract-shared'
import { createVoiceBilingualFields } from './voice-bilingual'
import {
  fieldsForVoiceGroup,
  normalizeSpokenDate,
  normalizeSpokenNumber,
  normalizeSpokenStandard,
  splitSpokenFullName,
} from './voice-fields'
import type { ParsedGRFields } from './ocr-parser'
import type {
  VoiceBilingualFields,
  VoiceEntryMode,
  VoiceGroupId,
  VoiceLanguage,
  VoiceScript,
} from './voice-types'

/**
 * Gemini audio transport decision (live-spiked 2026-08-30): both the current
 * /v1beta/interactions API and legacy-labelled :generateContent accept inline
 * audio/webm. This adapter intentionally uses :generateContent + inline_data: a
 * live request returned one schema-conforming { transcript, fields } response,
 * matching the repository's existing Gemini transport and retry path. The same
 * clip through Interactions on gemini-2.5-flash ignored response_format, while
 * gemini-3.7-flash was listed but temporarily capacity-limited. Multi-entry uses
 * the same transport with the proven OCR-compatible students[] schema; its live
 * segmentation baseline is recorded after the final multi-student spike.
 *
 * Current audio docs: https://ai.google.dev/gemini-api/docs/audio
 * GenerateContent audio reference: https://ai.google.dev/gemini-api/docs/generate-content/audio
 */

export const DEFAULT_GEMINI_AUDIO_MODEL = 'gemini-3.7-flash'
const DEFAULT_SINGLE_TIMEOUT_MS = 45_000
const DEFAULT_MULTI_TIMEOUT_MS = 180_000
const NAME_FIELDS = new Set<keyof ParsedGRFields>([
  'student_name',
  'fathers_name',
  'mothers_name',
  'surname',
])
const DATE_FIELDS = new Set<keyof ParsedGRFields>([
  'date_of_birth',
  'admission_date',
  'leaving_date',
])
const STANDARD_FIELDS = new Set<keyof ParsedGRFields>([
  'admission_standard',
  'leaving_standard',
])

interface GeminiVoiceResultBase {
  transcript: string
  model: string
  error?: string
}

export interface GeminiAudioResult extends GeminiVoiceResultBase {
  mode: 'single'
  fields: VoiceBilingualFields
}

export interface GeminiMultiAudioResult extends GeminiVoiceResultBase {
  mode: 'multi'
  students: VoiceBilingualFields[]
}

export type GeminiVoiceResult = GeminiAudioResult | GeminiMultiAudioResult

interface GeminiVoiceOptionsBase {
  model?: string
  language?: VoiceLanguage
  timeoutMs?: number
  attempts?: number
  signal?: AbortSignal
}

export interface GeminiSingleVoiceOptions extends GeminiVoiceOptionsBase {
  mode: 'single'
  group: VoiceGroupId
}

export interface GeminiMultiVoiceOptions extends GeminiVoiceOptionsBase {
  mode: 'multi'
  expectedCount?: number | null
}

export type GeminiVoiceOptions = GeminiSingleVoiceOptions | GeminiMultiVoiceOptions

/** Compatibility options for the existing group-specific adapter wrapper. */
export type GeminiAudioOptions = GeminiVoiceOptionsBase

export function isGeminiAudioConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

function bilingualFieldSchema(field: keyof ParsedGRFields) {
  return {
    type: 'OBJECT',
    description: FIELD_DESCRIPTIONS[field],
    properties: {
      en: {
        type: 'STRING',
        description: 'Faithful English/Latin-script value from the audio, or an empty string when absent or uncertain.',
      },
      gu: {
        type: 'STRING',
        description: 'Gujarati-script rendering from the same spoken value, or an empty string when absent or uncertain.',
      },
    },
    required: ['en', 'gu'],
  }
}

function singleResponseSchema(group: VoiceGroupId) {
  const groupFields = fieldsForVoiceGroup(group)
  return {
    type: 'OBJECT',
    properties: {
      transcript: {
        type: 'STRING',
        description: 'A faithful Latin-script transcript of the complete spoken utterance.',
      },
      fields: {
        type: 'OBJECT',
        properties: Object.fromEntries(groupFields.map((field) => [field, bilingualFieldSchema(field)])),
        required: [...groupFields],
      },
    },
    required: ['transcript', 'fields'],
  }
}

function multiResponseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      transcript: {
        type: 'STRING',
        description: 'A faithful Latin-script transcript of the complete multi-student utterance.',
      },
      students: {
        type: 'ARRAY',
        description: 'One complete object per student, in the order spoken.',
        items: {
          type: 'OBJECT',
          properties: Object.fromEntries(STRING_FIELDS.map((field) => [field, bilingualFieldSchema(field)])),
          required: [...STRING_FIELDS],
        },
      },
    },
    required: ['transcript', 'students'],
  }
}

function commonVoiceRules(language: VoiceLanguage): string {
  return `The audio is spoken English (${language}).
- Every field value is an object with both "en" and "gu" strings derived from this same audio response.
- Never invent, infer, or silently correct a value. Use "" in the uncertain script rather than guessing.
- Put the faithful English/Latin-script value in "en".
- Put the Gujarati-script value in "gu". Transliterate every proper noun phonetically from the pronunciation heard in the audio; never translate a proper noun's meaning. If its pronunciation is not clear enough to transliterate, return "" for "gu".
- Translate ordinary descriptive phrases into Gujarati without changing their meaning.
- For gr_number, date_of_birth, admission_date, and leaving_date, return the same normalized Western-digit value in both scripts; these identity/date values must never be transliterated.
- For previous_school_district and previous_school_subdistrict, return the spoken location names in both scripts. The application resolves them to canonical LGD keys locally; do not invent a code.
- A two-part student full name such as "Jagdish Dixit" means student_name "Jagdish" and surname "Dixit". A three-part register name is <student given name> <father given name> <surname>.
- Explicit labels such as "father", "mother", "surname", and "GR number" override positional splitting.
- Dates are day-first Indian dates. Convert spoken dates to YYYY-MM-DD: "sixth January two thousand sixteen" and "six one twenty sixteen" both mean 2016-01-06. Reject impossible dates.
- Standards/classes must be Western digits 1 through 12: "standard one" means "1" in both scripts.
- GR numbers and other spoken numbers must use Western digits.
- The transcript must be a faithful Latin-script record of the complete utterance; it must not be empty, summarized, translated, or replaced by extracted fields.`
}

function singleVoicePrompt(group: VoiceGroupId, language: VoiceLanguage): string {
  const fields = fieldsForVoiceGroup(group)
  return `You are extracting ONE section of one Indian school General Register (GR) record from speech.

Return one JSON object containing BOTH a faithful transcript of the complete utterance and a fields object. They must come from this same audio response so the transcript is the audit trail.

Allowed fields for this section: ${fields.join(', ')}.
- Include every allowed key and never return fields outside this list.
${commonVoiceRules(language)}`
}

function multiVoicePrompt(
  language: VoiceLanguage,
  expectedCount?: number | null
): string {
  const countHint = expectedCount
    ? `The operator expects ${expectedCount} entries. Use that only as a segmentation hint and accuracy check.`
    : 'The operator selected Auto count. Detect the number of student entries from the speech.'

  return `You are extracting MULTIPLE student records from one free-form Indian school General Register (GR) dictation.

Return one JSON object containing BOTH a faithful transcript of the complete utterance and a students array. They must come from this same audio response so the transcript is the audit trail.

- Return one students[] object per actual student, in spoken order, with every allowed GR field key.
- Honour spoken boundaries such as "entry one", "entry two", "next entry", and "next student".
- Never merge two students into one object and never split one student into two objects.
- Never pad the array to meet an expected count and never truncate real students to fit it.
- ${countHint}
- Allowed fields for every student: ${STRING_FIELDS.join(', ')}.
${commonVoiceRules(language)}`
}

function isLatinName(value: string): boolean {
  return /\p{Script=Latin}/u.test(value) && !/[^\p{Script=Latin}\p{Mark}\s.'’-]/u.test(value)
}

function isGujaratiName(value: string): boolean {
  return /\p{Script=Gujarati}/u.test(value) && !/[^\p{Script=Gujarati}\p{Mark}\s.'’-]/u.test(value)
}

function rawScriptValue(
  source: Record<string, unknown>,
  field: keyof ParsedGRFields,
  script: VoiceScript
): string {
  const raw = source[field]
  if (raw && typeof raw === 'object') {
    const value = (raw as Record<string, unknown>)[script]
    return typeof value === 'string' ? value : ''
  }
  // Accept the old scalar shape only as English so a malformed/old response can
  // never masquerade as an AI-generated Gujarati transliteration.
  return script === 'en' && typeof raw === 'string' ? raw : ''
}

function normalizeRawFields(
  raw: unknown,
  allowedFields: readonly (keyof ParsedGRFields)[],
  script: VoiceScript,
  splitStudentName: boolean
): Record<string, string> {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const normalized: Record<string, string> = {}

  for (const field of allowedFields) {
    const value = rawScriptValue(source, field, script)
    if (!value.trim()) continue
    let cleaned = value.trim()

    if (DATE_FIELDS.has(field) && !/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      cleaned = normalizeSpokenDate(cleaned) ?? ''
    } else if (STANDARD_FIELDS.has(field)) {
      cleaned = normalizeSpokenStandard(cleaned) ?? ''
    } else if (field === 'gr_number') {
      const withoutLabel = cleaned.replace(/\b(?:g\s*r|general register|register)\s*(?:number|no\.?)?\b/gi, ' ')
      cleaned = normalizeSpokenNumber(withoutLabel) ?? ''
    } else if (NAME_FIELDS.has(field)) {
      const validName = script === 'en' ? isLatinName(cleaned) : isGujaratiName(cleaned)
      if (!validName) cleaned = ''
    }

    if (cleaned) normalized[field] = cleaned
  }

  // Defensive split if the model left a full name in student_name despite the
  // schema instructions. Do not overwrite explicitly extracted values.
  if (splitStudentName && normalized.student_name?.includes(' ')) {
    const split = splitSpokenFullName(normalized.student_name)
    if (split) {
      normalized.student_name = split.student_name
      if (!normalized.fathers_name && split.fathers_name) normalized.fathers_name = split.fathers_name
      if (!normalized.surname && split.surname) normalized.surname = split.surname
    }
  }

  return normalized
}

function extractCandidateText(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const candidates = (data as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) return ''
  const first = candidates[0] as { content?: { parts?: Array<{ text?: unknown }> } } | undefined
  const parts = first?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts.map((part) => typeof part.text === 'string' ? part.text : '').join('').trim()
}

function failedResult(
  mode: VoiceEntryMode,
  model: string,
  error: string
): GeminiVoiceResult {
  const emptyFields: VoiceBilingualFields = { en: {}, gu: {}, sources: {} }
  return mode === 'single'
    ? { mode, transcript: '', fields: emptyFields, model, error }
    : { mode, transcript: '', students: [], model, error }
}

export function extractVoice(
  audio: Buffer,
  mimeType: string,
  options: GeminiSingleVoiceOptions
): Promise<GeminiAudioResult>
export function extractVoice(
  audio: Buffer,
  mimeType: string,
  options: GeminiMultiVoiceOptions
): Promise<GeminiMultiAudioResult>
export async function extractVoice(
  audio: Buffer,
  mimeType: string,
  options: GeminiVoiceOptions
): Promise<GeminiVoiceResult> {
  const apiKey = process.env.GEMINI_API_KEY
  const model = options.model || process.env.GEMINI_AUDIO_MODEL || DEFAULT_GEMINI_AUDIO_MODEL
  const language = options.language || 'en-IN'
  if (!apiKey) return failedResult(options.mode, model, 'GEMINI_API_KEY not configured')

  const defaultTimeout = options.mode === 'multi'
    ? DEFAULT_MULTI_TIMEOUT_MS
    : DEFAULT_SINGLE_TIMEOUT_MS
  const timeoutMs = Math.max(1, options.timeoutMs ?? defaultTimeout)
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort(new DOMException('Gemini audio request timed out', 'AbortError'))
  }, timeoutMs)
  const abortFromCaller = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) abortFromCaller()
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true })

  try {
    const prompt = options.mode === 'single'
      ? singleVoicePrompt(options.group, language)
      : multiVoicePrompt(language, options.expectedCount)
    const schema = options.mode === 'single'
      ? singleResponseSchema(options.group)
      : multiResponseSchema()

    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: audio.toString('base64') } },
              { text: prompt },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0,
          },
        }),
      },
      options.attempts ?? 3
    )

    if (!response.ok) {
      const detail = await response.text()
      return failedResult(
        options.mode,
        model,
        `Gemini audio returned ${response.status}: ${detail.slice(0, 300)}`
      )
    }

    const envelope = await response.json() as unknown
    const text = extractCandidateText(envelope)
    if (!text) return failedResult(options.mode, model, 'Gemini audio returned no content')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return failedResult(options.mode, model, 'Gemini audio response was not valid JSON')
    }

    if (!parsed || typeof parsed !== 'object') {
      return failedResult(options.mode, model, 'Gemini audio response was not an object')
    }
    const object = parsed as Record<string, unknown>
    const transcript = typeof object.transcript === 'string' ? object.transcript.trim() : ''
    if (!transcript) return failedResult(options.mode, model, 'Gemini audio returned an empty transcript')

    if (options.mode === 'single') {
      const allowedFields = fieldsForVoiceGroup(options.group)
      const parseScript = (script: VoiceScript) => toParsedRecord(
        normalizeRawFields(
          object.fields,
          allowedFields,
          script,
          options.group === 'identity'
        ),
        'high',
        {
          allowedFields,
          requireIdentity: false,
          downgradeAdmissionLeavingAmbiguity: false,
        }
      ) ?? {}
      const fields = createVoiceBilingualFields(parseScript('en'), parseScript('gu'))
      return { mode: 'single', transcript, fields, model }
    }

    const rawStudents = Array.isArray(object.students) ? object.students : []
    const students = rawStudents.flatMap((student) => {
      const en = toParsedRecord(
        normalizeRawFields(student, STRING_FIELDS, 'en', true),
        'high'
      )
      if (!en) return []
      const gu = toParsedRecord(
        normalizeRawFields(student, STRING_FIELDS, 'gu', true),
        'high',
        { requireIdentity: false }
      ) ?? {}
      return [createVoiceBilingualFields(en, gu)]
    })
    return { mode: 'multi', transcript, students, model }
  } catch (error) {
    const message = timedOut
      ? `Gemini audio request timed out after ${timeoutMs} ms`
      : options.signal?.aborted
        ? 'Gemini audio request was cancelled'
        : `Gemini audio extraction failed: ${error instanceof Error ? error.message : String(error)}`
    return failedResult(options.mode, model, message)
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

/** Existing single-group convenience wrapper retained for callers and tests. */
export function extractVoiceFields(
  audio: Buffer,
  mimeType: string,
  group: VoiceGroupId,
  options: GeminiAudioOptions = {}
): Promise<GeminiAudioResult> {
  return extractVoice(audio, mimeType, {
    ...options,
    mode: 'single',
    group,
  })
}
