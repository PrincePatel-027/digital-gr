/**
 * Mistral Extraction — Mistral (vision) structured GR extraction.
 *
 * Second vision provider in the chain: an independent frontier VLM, so if Gemini
 * is unavailable (or weak on a given page) Mistral reads the image directly and
 * returns the same structured records. Uses the OpenAI-style Chat Completions API
 * with a base64 image and JSON output.
 *
 * Key from https://console.mistral.ai/. Optional MISTRAL_MODEL overrides the model.
 */

import sharp from 'sharp'
import type { ParsedGRFields } from './ocr-parser'
import {
  EXTRACTION_PROMPT,
  toParsedRecords,
  extractStudentsArray,
  fetchWithRetry,
} from './extract-shared'

// Mistral Small 3.2 is multimodal and cost-effective. Override with MISTRAL_MODEL
// (e.g. mistral-medium-latest) for higher accuracy on difficult handwriting.
const DEFAULT_MODEL = 'mistral-small-latest'

export interface MistralExtractResult {
  records: ParsedGRFields[]
  mode: 'mistral'
  raw: string
  error?: string
}

export function isMistralConfigured(): boolean {
  return !!process.env.MISTRAL_API_KEY
}

export async function extractGRRecordsMistral(imageBuffer: Buffer): Promise<MistralExtractResult> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    return { records: [], mode: 'mistral', raw: '', error: 'MISTRAL_API_KEY not configured' }
  }
  const model = process.env.MISTRAL_MODEL || DEFAULT_MODEL

  try {
    const jpeg = await sharp(imageBuffer).rotate().jpeg({ quality: 92 }).toBuffer()
    const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`

    const body = JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            { type: 'image_url', image_url: dataUrl },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 8000,
    })

    const res = await fetchWithRetry('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    })

    if (!res.ok) {
      const errText = await res.text()
      return { records: [], mode: 'mistral', raw: '', error: `Mistral returned ${res.status}: ${errText.slice(0, 300)}` }
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    // Content is usually a string; some responses chunk it into an array.
    const text: string =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map((c: { text?: string }) => c?.text || '').join('')
          : ''

    if (!text) {
      return { records: [], mode: 'mistral', raw: JSON.stringify(data).slice(0, 300), error: 'Mistral returned no content' }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { records: [], mode: 'mistral', raw: text, error: 'Mistral response was not valid JSON' }
    }

    const records = toParsedRecords(extractStudentsArray(parsed))
    return { records, mode: 'mistral', raw: text }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { records: [], mode: 'mistral', raw: '', error: `Mistral extraction failed: ${message}` }
  }
}
