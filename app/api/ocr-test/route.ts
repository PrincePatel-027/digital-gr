import { NextRequest, NextResponse } from 'next/server'
import { extractText, isOcrMockMode } from '@/lib/ocr'
import { extractGRRecords, structureWithGemini, isGeminiConfigured } from '@/lib/gemini-extract'
import { extractGRRecordsMistral, isMistralConfigured } from '@/lib/mistral-extract'
import { structureWithSarvam, isSarvamConfigured } from '@/lib/sarvam-structure'
import type { ParsedGRFields } from '@/lib/ocr-parser'

interface Attempt {
  label: string
  run: () => Promise<{ records: ParsedGRFields[]; raw: string; mode: string; error?: string }>
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided. Send a form field named "image".' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
      'application/pdf',
    ]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Accepted: JPG, PNG, WebP, TIFF, PDF.`,
        },
        { status: 400 }
      )
    }

    // Size limit: 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10 MB.' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const fileMeta = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    }
    const warnings: string[] = []

    // ── Step 1: OCR the page FIRST ────────────────────────────────────────────
    // The OCR transcription is the factual anchor for everything that follows.
    // Asking a vision model to invent JSON straight from handwriting makes it
    // hallucinate names; grounding it in a real transcription does not.
    const ocr = await extractText(buffer)
    const ocrText = ocr.text && ocr.text !== '(No text detected in image)' ? ocr.text : ''
    if (ocr.error) warnings.push(`ocr: ${ocr.error}`)

    // ── Step 2: structured extraction, most-grounded strategy first ───────────
    const attempts: Attempt[] = []

    if (ocrText) {
      // Hybrid: image + OCR transcription. Best of both — correct spellings from
      // the transcription, correct column mapping from the image.
      if (isGeminiConfigured()) {
        attempts.push({ label: 'gemini+ocr', run: () => extractGRRecords(buffer, ocrText) })
      }
      // Text-only: cannot hallucinate handwriting, every value must come from the text.
      if (isGeminiConfigured()) {
        attempts.push({ label: 'gemini-text', run: () => structureWithGemini(ocrText) })
      }
      if (isMistralConfigured()) {
        attempts.push({ label: 'mistral+ocr', run: () => extractGRRecordsMistral(buffer, ocrText) })
      }
      if (isSarvamConfigured()) {
        attempts.push({ label: 'sarvam-text', run: () => structureWithSarvam(ocrText) })
      }
    } else {
      // No usable OCR text — fall back to reading the image directly.
      if (isGeminiConfigured()) {
        attempts.push({ label: 'gemini-vision', run: () => extractGRRecords(buffer) })
      }
      if (isMistralConfigured()) {
        attempts.push({ label: 'mistral-vision', run: () => extractGRRecordsMistral(buffer) })
      }
    }

    for (const attempt of attempts) {
      const r = await attempt.run()
      if (r.records.length > 0) {
        return NextResponse.json({
          records: r.records,
          // Always hand back the human-readable OCR text (not the model's JSON) so
          // the user can eyeball the page against the filled fields.
          text: ocrText || r.raw,
          mode: r.mode,
          source: attempt.label,
          mock: false,
          error: null,
          warning: warnings.join(' | ') || null,
          ...fileMeta,
        })
      }
      warnings.push(`${attempt.label}: ${r.error || 'no records found'}`)
    }

    // ── Step 3: nothing structured — return the raw text for manual entry ─────
    return NextResponse.json({
      text: ocr.text,
      mode: ocr.mode,
      mock: ocr.mode === 'mock',
      error: ocrText ? null : (ocr.error || warnings.join(' | ') || 'Could not extract any text from the image.'),
      warning: warnings.join(' | ') || null,
      ...fileMeta,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('OCR endpoint error:', message)
    return NextResponse.json(
      { error: `Server error: ${message}` },
      { status: 500 }
    )
  }
}

// GET — quick health check: which strategies are active, in order.
export async function GET() {
  const gemini = isGeminiConfigured()
  const mistral = isMistralConfigured()
  const sarvam = isSarvamConfigured()

  const chain: string[] = ['ocr.space (transcribe page)']
  if (gemini) chain.push(`gemini+ocr (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})`, 'gemini-text')
  if (mistral) chain.push(`mistral+ocr (${process.env.MISTRAL_MODEL || 'mistral-small-latest'})`)
  if (sarvam) chain.push(`sarvam-text (${process.env.SARVAM_MODEL || 'sarvam-30b'})`)

  return NextResponse.json({
    status: 'ok',
    mock: isOcrMockMode(),
    strategies: chain,
    message:
      gemini || mistral || sarvam
        ? `The page is transcribed by OCR first, then structured by: ${chain.slice(1).join(' → ')} (first one that returns records wins).`
        : 'No AI provider configured — only raw OCR text will be returned. Add GEMINI_API_KEY / MISTRAL_API_KEY / SARVAM_API_KEY.',
  })
}
