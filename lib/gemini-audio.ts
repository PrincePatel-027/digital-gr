import 'server-only'

import {
  FIELD_DESCRIPTIONS,
  STRING_FIELDS,
  fetchWithRetry,
  toParsedRecord,
  toParsedRecords,
} from './extract-shared'
import {
  fieldsForVoiceGroup,
  normalizeSpokenDate,
  normalizeSpokenNumber,
  normalizeSpokenStandard,
  splitSpokenFullName,
} from './voice-fields'
import type { ParsedGRFields } from './ocr-parser'
import type {
  VoiceEntryMode,
  VoiceGroupId,
  VoiceLanguage,
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
  fields: ParsedGRFields
}

export interface GeminiMultiAudioResult extends GeminiVoiceResultBase {
  mode: 'multi'
  students: ParsedGRFields[]
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

function stringFieldSchema(field: keyof ParsedGRFields) {
  return {
    type: 'STRING',
    description: `${FIELD_DESCRIPTIONS[field]} For voice entry, preserve Latin spelling exactly as spoken and use an empty string when absent.`,
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
        properties: Object.fromEntries(groupFields.map((field) => [field, stringFieldSchema(field)])),
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
          properties: Object.fromEntries(STRING_FIELDS.map((field) => [field, stringFieldSchema(field)])),
          required: [...STRING_FIELDS],
        },
      },
    },
    required: ['transcript', 'students'],
  }
}

function commonVoiceRules(language: VoiceLanguage): string {
  return `The audio is spoken English (${language}).
- Never invent, infer, translate, or silently correct a value. Use "" when a value was not spoken or is uncertain.
- Store every name in Latin script exactly as spoken. Do not transliterate it into Gujarati or another script.
- A two-part student full name such as "Jagdish Dixit" means student_name "Jagdish" and surname "Dixit". A three-part register name is <student given name> <father given name> <surname>.
- Explicit labels such as "father", "mother", "surname", and "GR number" override positional splitting.
- Dates are day-first Indian dates. Convert spoken dates to YYYY-MM-DD: "sixth January two thousand sixteen" and "six one twenty sixteen" both mean 2016-01-06. Reject impossible dates.
- Standards/classes must be digits 1 through 12: "standard one" means "1".
- GR numbers and other spoken numbers must use Western digits.
- The transcript must not be empty, summarized, translated, or replaced by extracted fields.`
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

function normalizeRawFields(
  raw: unknown,
  allowedFields: readonly (keyof ParsedGRFields)[],
  splitStudentName: boolean
): Record<string, string> {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const normalized: Record<string, string> = {}

  for (const field of allowedFields) {
    const value = source[field]
    if (typeof value !== 'string' || !value.trim()) continue
    let cleaned = value.trim()

    if (DATE_FIELDS.has(field) && !/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      cleaned = normalizeSpokenDate(cleaned) ?? ''
    } else if (STANDARD_FIELDS.has(field)) {
      cleaned = normalizeSpokenStandard(cleaned) ?? ''
    } else if (field === 'gr_number') {
      const withoutLabel = cleaned.replace(/\b(?:g\s*r|general register|register)\s*(?:number|no\.?)?\b/gi, ' ')
      cleaned = normalizeSpokenNumber(withoutLabel) ?? ''
    } else if (NAME_FIELDS.has(field) && !isLatinName(cleaned)) {
      // Empty is safer than silently transliterating a name into a different script.
      cleaned = ''
    }

    if (cleaned) normalized[field] = cleaned
  }

  // Defensive split if the model left a full name in student_name despite the schema
  // instructions. Do not overwrite explicitly extracted father/surname values.
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
  return mode === 'single'
    ? { mode, transcript: '', fields: {}, model, error }
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
      const fields = toParsedRecord(
        normalizeRawFields(object.fields, allowedFields, options.group === 'identity'),
        'high',
        {
          allowedFields,
          requireIdentity: false,
          downgradeAdmissionLeavingAmbiguity: false,
        }
      ) ?? {}
      return { mode: 'single', transcript, fields, model }
    }

    const rawStudents = Array.isArray(object.students) ? object.students : []
    const normalizedStudents = rawStudents.map((student) => (
      normalizeRawFields(student, STRING_FIELDS, true)
    ))
    // Keep the existing collection mapper untouched; it remains the canonical
    // complete-record sanitation and identity filter for OCR and multi voice.
    // Live release spike (2026-08-30): a synthetic two-entry WAV reached
    // gemini-3.7-flash, but Gemini returned HTTP 503 before segmentation.
    const students = toParsedRecords(normalizedStudents, 'high')
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
