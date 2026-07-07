/**
 * OCR Module — OCR.space API integration (FREE, no billing required)
 *
 * OCR.space free tier: 25,000 requests/month
 * Supports: English, Hindi, Gujarati, and 20+ languages
 */

import sharp from 'sharp'

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

// ── Classify why an OCR pass failed (for logging) ─────────────
function describeOcrFailure(reason: unknown): string {
  const msg = reason instanceof Error ? reason.message : String(reason)
  // OCR.space returns HTTP 5xx / E563 when an engine exceeds the 60s free-tier cap.
  if (/\b50\d\b|timed?\s*out|timeout|E563/i.test(msg)) return `timeout/server — ${msg}`
  if (/\b40[13]\b|apikey|api key|unauthorized|invalid.*key/i.test(msg)) return `auth — ${msg}`
  if (/fetch failed|network|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT/i.test(msg)) return `network — ${msg}`
  return msg
}

// ── Call OCR.space API ────────────────────────────────────────
async function callOcrSpace(imageBuffer: Buffer): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY
  if (!apiKey) throw new Error('OCR_SPACE_API_KEY environment variable is not configured. Please add your free OCR.space API key.')

  const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`

  // Run both passes CONCURRENTLY and independently. Engine 3 (Gujarati) can hit
  // OCR.space's 60s cap on dense pages and reject; running via allSettled means a
  // failure in one pass no longer blocks or discards the other. We only fail hard
  // when BOTH passes fail.
  //   Pass 1 — Gujarati, Engine 3 (only engine supporting guj; also picks up English)
  //   Pass 2 — English,  Engine 2 (better for handwritten Latin: GR numbers, dates)
  const [gujSettled, engSettled] = await Promise.allSettled([
    ocrSpaceRequest(apiKey, base64Image, { language: 'guj', engine: '3' }),
    ocrSpaceRequest(apiKey, base64Image, { language: 'eng', engine: '2' }),
  ])

  // Both passes failed → surface both reasons so the caller/logs show the full picture.
  if (gujSettled.status === 'rejected' && engSettled.status === 'rejected') {
    throw new Error(
      `Both OCR passes failed. ` +
      `Gujarati/Engine3: ${describeOcrFailure(gujSettled.reason)} | ` +
      `English/Engine2: ${describeOcrFailure(engSettled.reason)}`
    )
  }

  // Exactly one pass failed → log which engine/language failed and why, then proceed
  // with the successful pass alone.
  if (gujSettled.status === 'rejected') {
    console.warn(`OCR Gujarati/Engine3 pass failed — continuing with English only: ${describeOcrFailure(gujSettled.reason)}`)
  }
  if (engSettled.status === 'rejected') {
    console.warn(`OCR English/Engine2 pass failed — continuing with Gujarati only: ${describeOcrFailure(engSettled.reason)}`)
  }

  const gujText = gujSettled.status === 'fulfilled' ? gujSettled.value.trim() : ''
  const engText = engSettled.status === 'fulfilled' ? engSettled.value.trim() : ''

  if (!gujText && !engText) return '(No text detected in image)'
  if (!gujText) return engText
  if (!engText) return gujText

  // Combine both passes so the parser can extract from either!
  // We put Gujarati first so its labels are prioritized if found.
  return `${gujText}\n\n${engText}`.trim()
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

// ── Split a two-page register spread into left + right pages ──
// A photographed open register shows two pages side-by-side in ONE image. OCR-ing
// the whole spread at once pushes Engine 3 (Gujarati) past OCR.space's 60s cap
// (error E563). Splitting it down the middle makes each page a separate, smaller
// request that Engine 3 can finish. Single portrait pages and non-raster inputs
// (e.g. PDFs) are left whole.
interface PageSegment { label: string; buf: Buffer }

async function splitIntoPages(imageBuffer: Buffer): Promise<PageSegment[]> {
  try {
    // Bake EXIF orientation first so width/height match what a human sees.
    const { data: normalized, info } = await sharp(imageBuffer)
      .rotate()
      .toBuffer({ resolveWithObject: true })
    const { width, height } = info

    // A two-page spread is markedly wider than tall. Only split when landscape,
    // so we never cut a single portrait page in half.
    if (width && height && width > height * 1.2) {
      const half = Math.floor(width / 2)
      const left = await sharp(normalized)
        .extract({ left: 0, top: 0, width: half, height })
        .jpeg({ quality: 92 })
        .toBuffer()
      const right = await sharp(normalized)
        .extract({ left: half, top: 0, width: width - half, height })
        .jpeg({ quality: 92 })
        .toBuffer()
      return [
        { label: 'left-page', buf: left },
        { label: 'right-page', buf: right },
      ]
    }
  } catch (err) {
    // Non-raster input (PDF) or a sharp failure → OCR the whole image unchanged.
    console.warn(`OCR page-split skipped (${err instanceof Error ? err.message : String(err)}); OCR-ing whole image.`)
  }
  return [{ label: 'full', buf: imageBuffer }]
}

// ── Main export ───────────────────────────────────────────────
export async function extractText(imageBuffer: Buffer): Promise<OcrResult> {
  try {
    const segments = await splitIntoPages(imageBuffer)

    // OCR each page segment independently (each runs its own concurrent dual-pass).
    // allSettled so one page failing (still too dense, rate limit, etc.) doesn't
    // discard a page that succeeded.
    const settled = await Promise.allSettled(segments.map((s) => callOcrSpace(s.buf)))

    const texts: string[] = []
    const failures: string[] = []
    settled.forEach((res, i) => {
      if (res.status === 'fulfilled') texts.push(res.value)
      else failures.push(`${segments[i].label}: ${res.reason instanceof Error ? res.reason.message : String(res.reason)}`)
    })

    // Every segment failed → surface the error.
    if (texts.length === 0) {
      return { text: '', mode: 'real', error: `OCR failed: ${failures.join(' | ')}` }
    }
    if (failures.length) {
      console.warn(`OCR: ${failures.length} of ${segments.length} page segment(s) failed — ${failures.join(' | ')}`)
    }

    // Merge in reading order (left page then right), dropping empty/placeholder segments.
    const merged = texts
      .map((t) => t.trim())
      .filter((t) => t && t !== '(No text detected in image)')
      .join('\n\n')

    return { text: merged || '(No text detected in image)', mode: 'real' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      text: '',
      mode: 'real',
      error: `OCR failed: ${message}`,
    }
  }
}
