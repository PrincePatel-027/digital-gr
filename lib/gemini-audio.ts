import 'server-only'

import { FIELD_DESCRIPTIONS, fetchWithRetry, toParsedRecord } from './extract-shared'
import {
  fieldsForVoiceGroup,
  normalizeSpokenDate,
  normalizeSpokenNumber,
  normalizeSpokenStandard,
  splitSpokenFullName,
} from './voice-fields'
import type { ParsedGRFields } from './ocr-parser'
import type { VoiceGroupId, VoiceLanguage } from './voice-types'

/**
 * Gemini audio transport decision (live-spiked 2026-08-30): both the current
 * /v1beta/interactions API and legacy-labelled :generateContent accept inline
 * audio/webm. This adapter intentionally uses :generateContent + inline_data: a
 * live request returned one schema-conforming { transcript, fields } response,
 * matching the repository's existing Gemini transport and retry path. The same
 * clip through Interactions on gemini-2.5-flash ignored response_format, while
 * gemini-3.7-flash was listed but temporarily capacity-limited. Revisit this when
 * Interactions structured audio is reliable for every configured comparison model.
 *
 * Current audio docs: https://ai.google.dev/gemini-api/docs/audio
 * GenerateContent audio reference: https://ai.google.dev/gemini-api/docs/generate-content/audio
 */

export const DEFAULT_GEMINI_AUDIO_MODEL = 'gemini-3.7-flash'
const DEFAULT_TIMEOUT_MS = 45_000
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

export interface GeminiAudioResult {
  transcript: string
  fields: ParsedGRFields
  model: string
  error?: string
}

export interface GeminiAudioOptions {
  model?: string
  language?: VoiceLanguage
  timeoutMs?: number
  attempts?: number
  signal?: AbortSignal
}

export function isGeminiAudioConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

function responseSchema(group: VoiceGroupId) {
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
        properties: Object.fromEntries(groupFields.map((field) => [
          field,
          {
            type: 'STRING',
            description: `${FIELD_DESCRIPTIONS[field]} For voice entry, preserve Latin spelling exactly as spoken and use an empty string when absent.`,
          },
        ])),
        required: [...groupFields],
      },
    },
    required: ['transcript', 'fields'],
  }
}

function voicePrompt(group: VoiceGroupId, language: VoiceLanguage): string {
  const fields = fieldsForVoiceGroup(group)
  return `You are extracting ONE section of one Indian school General Register (GR) record from spoken English (${language}).

Return one JSON object containing BOTH a faithful transcript of the complete utterance and a fields object. They must come from this same audio response so the transcript is the audit trail.

Allowed fields for this section: ${fields.join(', ')}.
- Include every allowed key. Use "" when it was not spoken or is uncertain.
- Never invent, infer, translate, or silently correct a value. Never return fields outside this list.
- Store every name in Latin script exactly as spoken. Do not transliterate it into Gujarati or another script.
- A two-part student full name such as "Jagdish Dixit" means student_name "Jagdish" and surname "Dixit". A three-part register name is <student given name> <father given name> <surname>.
- Explicit labels such as "father", "mother", "surname", and "GR number" override positional splitting.
- Dates are day-first Indian dates. Convert spoken dates to YYYY-MM-DD: "sixth January two thousand sixteen" and "six one twenty sixteen" both mean 2016-01-06. Reject impossible dates.
- Standards/classes must be digits 1 through 12: "standard one" means "1".
- GR numbers and other spoken numbers must use Western digits.
- The transcript must not be empty, summarized, translated, or replaced by the fields.`
}

function isLatinName(value: string): boolean {
  return /\p{Script=Latin}/u.test(value) && !/[^\p{Script=Latin}\p{Mark}\s.'’-]/u.test(value)
}

function normalizeRawFields(raw: unknown, group: VoiceGroupId): Record<string, string> {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const normalized: Record<string, string> = {}

  for (const field of fieldsForVoiceGroup(group)) {
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
  if (group === 'identity' && normalized.student_name?.includes(' ')) {
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

export async function extractVoiceFields(
  audio: Buffer,
  mimeType: string,
  group: VoiceGroupId,
  options: GeminiAudioOptions = {}
): Promise<GeminiAudioResult> {
  const apiKey = process.env.GEMINI_API_KEY
  const model = options.model || process.env.GEMINI_AUDIO_MODEL || DEFAULT_GEMINI_AUDIO_MODEL
  const language = options.language || 'en-IN'
  if (!apiKey) {
    return { transcript: '', fields: {}, model, error: 'GEMINI_API_KEY not configured' }
  }

  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
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
              { text: voicePrompt(group, language) },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema(group),
            temperature: 0,
          },
        }),
      },
      options.attempts ?? 3
    )

    if (!response.ok) {
      const detail = await response.text()
      return {
        transcript: '',
        fields: {},
        model,
        error: `Gemini audio returned ${response.status}: ${detail.slice(0, 300)}`,
      }
    }

    const envelope = await response.json() as unknown
    const text = extractCandidateText(envelope)
    if (!text) {
      return { transcript: '', fields: {}, model, error: 'Gemini audio returned no content' }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { transcript: '', fields: {}, model, error: 'Gemini audio response was not valid JSON' }
    }

    if (!parsed || typeof parsed !== 'object') {
      return { transcript: '', fields: {}, model, error: 'Gemini audio response was not an object' }
    }
    const object = parsed as Record<string, unknown>
    const transcript = typeof object.transcript === 'string' ? object.transcript.trim() : ''
    if (!transcript) {
      return { transcript: '', fields: {}, model, error: 'Gemini audio returned an empty transcript' }
    }

    const fields = toParsedRecord(normalizeRawFields(object.fields, group), 'high', {
      allowedFields: fieldsForVoiceGroup(group),
      requireIdentity: false,
      downgradeAdmissionLeavingAmbiguity: false,
    }) ?? {}

    return { transcript, fields, model }
  } catch (error) {
    const message = timedOut
      ? `Gemini audio request timed out after ${timeoutMs} ms`
      : options.signal?.aborted
        ? 'Gemini audio request was cancelled'
        : `Gemini audio extraction failed: ${error instanceof Error ? error.message : String(error)}`
    return { transcript: '', fields: {}, model, error: message }
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}
