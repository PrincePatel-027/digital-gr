/**
 * Gemini Extraction — Google Gemini (vision) structured GR extraction.
 *
 * Reads the register image directly and returns structured student records as
 * JSON. Primary provider in the extraction chain. Free key from
 * https://aistudio.google.com/apikey. Optional GEMINI_MODEL overrides the model.
 */

import sharp from 'sharp'
import type { ParsedGRFields } from './ocr-parser'
import {
  STRING_FIELDS,
  buildExtractionPrompt,
  buildStructurePrompt,
  toParsedRecords,
  extractStudentsArray,
  fetchWithRetry,
} from './extract-shared'

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

/**
 * Extract records from the register image.
 *
 * `ocrText` (optional) is a real OCR transcription of the same page. When given,
 * the model is grounded in it — the single most effective guard against the model
 * inventing student names.
 */
export async function extractGRRecords(
  imageBuffer: Buffer,
  ocrText?: string
): Promise<GeminiExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { records: [], mode: 'gemini', raw: '', error: 'GEMINI_API_KEY not configured' }
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  try {
    // Normalize to JPEG + auto-orient (handles PNG/WebP/EXIF rotation).
    const jpeg = await sharp(imageBuffer).rotate().jpeg({ quality: 92 }).toBuffer()
    const base64 = jpeg.toString('base64')

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const body = JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            { text: buildExtractionPrompt(ocrText) },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    })

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
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

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { records: [], mode: 'gemini', raw: text, error: 'Gemini response was not valid JSON' }
    }

    const records = toParsedRecords(extractStudentsArray(parsed))
    return { records, mode: 'gemini', raw: text }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { records: [], mode: 'gemini', raw: '', error: `Gemini extraction failed: ${message}` }
  }
}

/**
 * Text-only structuring: turn an OCR transcription into structured records
 * WITHOUT showing the model the image. Because every value must come from the
 * transcription, this cannot invent handwriting it "thinks" it sees — it is the
 * most faithful path whenever the OCR text is decent.
 */
export async function structureWithGemini(ocrText: string): Promise<GeminiExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { records: [], mode: 'gemini', raw: '', error: 'GEMINI_API_KEY not configured' }
  }
  if (!ocrText || ocrText.trim().length < 10) {
    return { records: [], mode: 'gemini', raw: '', error: 'No OCR text to structure' }
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildStructurePrompt(ocrText) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0,
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { records: [], mode: 'gemini', raw: '', error: `Gemini text returned ${res.status}: ${errText.slice(0, 300)}` }
    }

    const data = await res.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!text) {
      return { records: [], mode: 'gemini', raw: '', error: 'Gemini text returned no content' }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { records: [], mode: 'gemini', raw: text, error: 'Gemini text response was not valid JSON' }
    }

    return { records: toParsedRecords(extractStudentsArray(parsed)), mode: 'gemini', raw: text }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { records: [], mode: 'gemini', raw: '', error: `Gemini text structuring failed: ${message}` }
  }
}
