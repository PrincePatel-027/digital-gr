/**
 * OCR Module — raw-text anchor for the extraction chain.
 *
 * PRIMARY: Sarvam Document AI (Vision 1.5) via `digitiseWithSarvam` — purpose-trained on
 * Indic scripts including handwritten Gujarati, so it transcribes GR pages far more
 * accurately than a generic engine.
 * FALLBACK: OCR.space (free, 25,000 req/month; English/Hindi/Gujarati + 20 more) — used
 * per-segment whenever Sarvam is unconfigured, fails, or times out. Kept because it is
 * free and reliable for the Latin/numeral pass (GR numbers, dates).
 */

import sharp from 'sharp'
import { digitiseWithSarvam, isSarvamDocAiConfigured } from './sarvam-doc-ai'
import { providerTimeoutMs } from './extract-shared'
import { preprocessForOcr } from './image-prep'

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

  // The only provider call in the chain that does not go through fetchWithRetry, so it
  // needs its own bound: Engine 3 holds a dense page for up to OCR.space's 60s cap and
  // Node's fetch would keep waiting past that, running the function into the platform's
  // hard limit instead of failing this one pass.
  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
    signal: AbortSignal.timeout(providerTimeoutMs()),
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

// ── Transcribe one page segment ───────────────────────────────
// Sarvam Document AI (Gujarati-specialised) first; if it is unconfigured, errors, times
// out, or returns nothing, fall back to the OCR.space dual-pass. A Sarvam failure here is
// never fatal — the segment simply degrades to OCR.space, and if that also fails the
// segment is dropped by the allSettled handling in extractText.
async function transcribeSegment(seg: PageSegment): Promise<string> {
  if (isSarvamDocAiConfigured()) {
    try {
      const text = await digitiseWithSarvam(seg.buf, `${seg.label}.jpg`)
      if (text && text.trim() && text.trim() !== '(No text detected in image)') return text
      console.warn(`Sarvam digitise returned no text for ${seg.label}; falling back to OCR.space.`)
    } catch (err) {
      console.warn(`Sarvam digitise failed for ${seg.label} — falling back to OCR.space: ${describeOcrFailure(err)}`)
    }
  }
  // OCR.space gets the cleaned image (Sarvam preprocesses inside its own upload step,
  // so segments are passed to it raw above — this keeps preprocessing applied once).
  return callOcrSpace(await preprocessForOcr(seg.buf))
}

// ── Main export ───────────────────────────────────────────────
export async function extractText(imageBuffer: Buffer): Promise<OcrResult> {
  try {
    const segments = await splitIntoPages(imageBuffer)

    // Transcribe each page segment independently (Sarvam Doc AI, else OCR.space dual-pass).
    // allSettled so one page failing (still too dense, rate limit, etc.) doesn't
    // discard a page that succeeded.
    const settled = await Promise.allSettled(segments.map((s) => transcribeSegment(s)))

    // Keep each result paired with its page label — a failed segment must not shift
    // the labels of the ones that succeeded.
    const texts: Array<{ label: string; text: string }> = []
    const failures: string[] = []
    settled.forEach((res, i) => {
      if (res.status === 'fulfilled') texts.push({ label: segments[i].label, text: res.value })
      else failures.push(`${segments[i].label}: ${res.reason instanceof Error ? res.reason.message : String(res.reason)}`)
    })

    // Every segment failed → surface the error.
    if (texts.length === 0) {
      return { text: '', mode: 'real', error: `OCR failed: ${failures.join(' | ')}` }
    }
    if (failures.length) {
      console.warn(`OCR: ${failures.length} of ${segments.length} page segment(s) failed — ${failures.join(' | ')}`)
    }

    // Merge in reading order (left page then right), dropping empty/placeholder
    // segments. Labels describe the actual physical form: identity/birth fields are
    // on the left, while admission continues at the start of the right page before
    // the starred leaving columns.
    const kept = texts
      .map((s) => ({ label: s.label, text: s.text.trim() }))
      .filter((s) => s.text && s.text !== '(No text detected in image)')

    const merged = kept
      .map((s) => {
        if (s.label === 'left-page') return `===== LEFT PAGE (પત્રક ૪ — identity, birth and previous school) =====\n${s.text}`
        if (s.label === 'right-page') return `===== RIGHT PAGE (પત્રક ૫ — admission continuation, then leaving fields) =====\n${s.text}`
        return s.text
      })
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
