/**
 * OCR Module — OCR.space API integration (FREE, no billing required)
 *
 * OCR.space free tier: 25,000 requests/month
 * Supports: English, Hindi, Gujarati, and 20+ languages
 */

// ── Types ─────────────────────────────────────────────────────
export interface OcrResult {
  text: string
  mode: 'real' | 'mock'
  confidence?: number
  error?: string
}

// ── Check mode ────────────────────────────────────────────────
export function isOcrMockMode(): boolean {
  return false; // Mock mode completely disabled
}

// ── Call OCR.space API ────────────────────────────────────────
async function callOcrSpace(imageBuffer: Buffer): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY
  if (!apiKey) throw new Error('OCR_SPACE_API_KEY environment variable is not configured. Please add your free OCR.space API key.')

  const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`

  // ── Pass 1: Gujarati + English with Engine 1 ──────────────
  // Engine 1 supports 25+ languages including Gujarati (guj) and Hindi (hin).
  // It automatically picks up English characters in the same document.
  const gujaratiResult = await ocrSpaceRequest(apiKey, base64Image, {
    language: 'guj',    // Gujarati — also reads English in the same image
    engine: '1',
  })

  // ── Pass 2: English-only with Engine 2 (better for handwriting) ──
  const englishResult = await ocrSpaceRequest(apiKey, base64Image, {
    language: 'eng',
    engine: '2',        // Engine 2 is better for handwritten Latin text
  })

  // Merge: use whichever returned more text, show both if significantly different
  const gujText = gujaratiResult.trim()
  const engText = englishResult.trim()

  if (!gujText && !engText) return '(No text detected in image)'
  if (!gujText) return engText
  if (!engText) return gujText

  // If both have results, combine them for maximum coverage
  if (gujText.length > engText.length * 1.3) {
    // Gujarati pass got significantly more — it's likely a Gujarati-heavy document
    return gujText
  } else if (engText.length > gujText.length * 1.3) {
    // English pass got significantly more — it's likely an English-heavy document
    return engText
  }

  // Similar length — combine both with a separator
  return `── Gujarati/Hindi OCR ──\n${gujText}\n\n── English OCR ──\n${engText}`
}

// ── Single OCR.space request helper ───────────────────────────
async function ocrSpaceRequest(
  apiKey: string,
  base64Image: string,
  opts: { language: string; engine: string }
): Promise<string> {
  const formData = new URLSearchParams()
  formData.append('apikey', apiKey)
  formData.append('base64Image', base64Image)
  formData.append('language', opts.language)
  formData.append('isOverlayRequired', 'false')
  formData.append('detectOrientation', 'true')
  formData.append('scale', 'true')
  formData.append('isTable', 'true') // Forces row-by-row parsing with tab separation
  formData.append('OCREngine', opts.engine)

  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OCR.space returned ${res.status}: ${errText}`)
  }

  const data = await res.json()

  if (data.IsErroredOnProcessing) {
    console.warn(`OCR.space error (${opts.language}/${opts.engine}):`, data.ErrorMessage)
    return ''
  }

  const parsedResults = data.ParsedResults || []
  return parsedResults
    .map((r: { ParsedText?: string }) => r.ParsedText || '')
    .join('\n')
    .trim()
}

// ── Main export ───────────────────────────────────────────────
export async function extractText(imageBuffer: Buffer): Promise<OcrResult> {
  try {
    const text = await callOcrSpace(imageBuffer)
    return { text, mode: 'real' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      text: '',
      mode: 'real',
      error: `OCR failed: ${message}`,
    }
  }
}
