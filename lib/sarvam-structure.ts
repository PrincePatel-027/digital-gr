/**
 * Sarvam Structuring — turn raw OCR text into structured GR records.
 *
 * Sarvam's vision model is an async batch/document pipeline (not suited to a
 * real-time scan), but its chat models are best-in-class at Indian languages.
 * So Sarvam's role in the chain is a Gujarati-native "structurer of last resort":
 * when the vision providers fail, we already have raw OCR text (OCR.space), and
 * Sarvam turns that noisy Gujarati/Devanagari text into the same JSON records.
 *
 * Key from https://dashboard.sarvam.ai/. Optional SARVAM_MODEL overrides the model.
 */

import type { ParsedGRFields } from './ocr-parser'
import { toParsedRecords, extractStudentsArray, fetchWithRetry, buildStructurePrompt } from './extract-shared'

const DEFAULT_MODEL = 'sarvam-30b'

export interface SarvamStructureResult {
  records: ParsedGRFields[]
  mode: 'sarvam'
  raw: string
  error?: string
}

export function isSarvamConfigured(): boolean {
  return !!process.env.SARVAM_API_KEY
}

export async function structureWithSarvam(ocrText: string): Promise<SarvamStructureResult> {
  const apiKey = process.env.SARVAM_API_KEY
  if (!apiKey) {
    return { records: [], mode: 'sarvam', raw: '', error: 'SARVAM_API_KEY not configured' }
  }
  if (!ocrText || ocrText.trim().length < 10) {
    return { records: [], mode: 'sarvam', raw: '', error: 'No OCR text to structure' }
  }
  const model = process.env.SARVAM_MODEL || DEFAULT_MODEL

  try {
    // sarvam-30b is a REASONING model: it spends tokens on `reasoning_content`
    // before answering. Left at the default effort it exhausts max_tokens and
    // returns finish_reason "length" with content: null (verified). Keeping the
    // effort low and the budget generous is what makes it actually answer.
    // Note: reasoning_effort "none" is rejected with HTTP 400 — "low" is the floor.
    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: buildStructurePrompt(ocrText) }],
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      temperature: 0,
      max_tokens: 16000,
    })

    const res = await fetchWithRetry('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body,
    })

    if (!res.ok) {
      const errText = await res.text()
      return { records: [], mode: 'sarvam', raw: '', error: `Sarvam returned ${res.status}: ${errText.slice(0, 300)}` }
    }

    const data = await res.json()
    const choice = data?.choices?.[0]
    // Fall back to reasoning_content: if the budget still ran out mid-answer the
    // JSON may only exist inside the reasoning trace.
    const text: string = choice?.message?.content || choice?.message?.reasoning_content || ''
    if (!text) {
      const finish = choice?.finish_reason || 'unknown'
      return { records: [], mode: 'sarvam', raw: JSON.stringify(data).slice(0, 300), error: `Sarvam returned no content (finish_reason: ${finish})` }
    }

    // Sarvam (a reasoning model) may wrap JSON in prose or ```json fences — pull the object out.
    const jsonText = extractJsonObject(text)

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return { records: [], mode: 'sarvam', raw: text, error: 'Sarvam response was not valid JSON' }
    }

    // Records reconstructed from noisy OCR — flag as medium confidence.
    const records = toParsedRecords(extractStudentsArray(parsed), 'medium')
    return { records, mode: 'sarvam', raw: text }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { records: [], mode: 'sarvam', raw: '', error: `Sarvam structuring failed: ${message}` }
  }
}

// Extract the first balanced JSON object from a string that may contain fences/prose.
function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return candidate.slice(start, end + 1)
  }
  return candidate.trim()
}
