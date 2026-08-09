/**
 * OpenAI Extraction — GPT-5 (vision) structured GR extraction.
 *
 * An independent frontier VLM in the chain. On current benchmarks the GPT-5 family is
 * a top performer on complex handwriting, and OpenAI's own vision guidance highlights
 * reading handwritten forms in a single pass — so it is a strong candidate for
 * handwritten Gujarati. Uses the Chat Completions API with a base64 image and JSON
 * output, mirroring lib/mistral-extract.ts.
 *
 * Key from https://platform.openai.com/api-keys. Optional OPENAI_MODEL overrides the
 * model (default: gpt-5.6 — the latest GPT-5 alias as of this writing).
 */

import type { ParsedGRFields } from './ocr-parser'
import {
  buildExtractionPrompt,
  toParsedRecords,
  extractStudentsArray,
  fetchWithRetry,
} from './extract-shared'
import { preprocessForOcr } from './image-prep'

const DEFAULT_MODEL = 'gpt-5.6'

export interface OpenAIExtractResult {
  records: ParsedGRFields[]
  mode: 'openai'
  raw: string
  error?: string
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}

/**
 * Extract records from the register image with GPT-5 vision.
 *
 * `ocrText` (optional) grounds the model in a real transcription of the same page —
 * the strongest guard against invented names. `model` overrides the default for
 * side-by-side comparison of different GPT-5 tiers.
 */
export async function extractGRRecordsOpenAI(
  imageBuffer: Buffer,
  ocrText?: string,
  model?: string
): Promise<OpenAIExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { records: [], mode: 'openai', raw: '', error: 'OPENAI_API_KEY not configured' }
  }
  const chosenModel = model || process.env.OPENAI_MODEL || DEFAULT_MODEL

  try {
    const jpeg = await preprocessForOcr(imageBuffer)
    const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`

    // Notes on request shape for GPT-5 (a reasoning model):
    //  - No `temperature`: reasoning models reject a non-default value.
    //  - `max_completion_tokens` (not `max_tokens`), generous so the reasoning trace
    //    doesn't starve the JSON answer.
    //  - `response_format: json_object` needs the word "JSON" in the prompt — the
    //    shared extraction prompt already asks for a JSON object.
    const body = JSON.stringify({
      model: chosenModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildExtractionPrompt(ocrText) },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 16000,
    })

    const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    })

    if (!res.ok) {
      const errText = await res.text()
      return { records: [], mode: 'openai', raw: '', error: `OpenAI returned ${res.status}: ${errText.slice(0, 300)}` }
    }

    const data = await res.json()
    const choice = data?.choices?.[0]
    const content = choice?.message?.content
    const text: string =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((c: { text?: string }) => c?.text || '').join('')
          : ''

    if (!text) {
      const reason = choice?.finish_reason || 'no content'
      return { records: [], mode: 'openai', raw: JSON.stringify(data).slice(0, 300), error: `OpenAI returned no content (${reason})` }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { records: [], mode: 'openai', raw: text, error: 'OpenAI response was not valid JSON' }
    }

    const records = toParsedRecords(extractStudentsArray(parsed))
    return { records, mode: 'openai', raw: text }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { records: [], mode: 'openai', raw: '', error: `OpenAI extraction failed: ${message}` }
  }
}
