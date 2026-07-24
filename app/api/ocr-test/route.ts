import { NextRequest, NextResponse } from 'next/server'
import { extractText, isOcrMockMode } from '@/lib/ocr'
import { extractGRRecords, isGeminiConfigured } from '@/lib/gemini-extract'
import { extractGRRecordsMistral, isMistralConfigured } from '@/lib/mistral-extract'
import { structureWithSarvam, isSarvamConfigured } from '@/lib/sarvam-structure'
import type { ParsedGRFields } from '@/lib/ocr-parser'

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

    // ── Extraction chain (each layer is tried only if the previous found nothing) ──
    //   1. Gemini  — vision → structured records
    //   2. Mistral — vision → structured records (independent VLM)
    //   3. OCR.space raw text → Sarvam (Gujarati-native) structures it → records
    //   4. Raw OCR text returned for the client's heuristic parser / manual entry

    // 1 + 2: vision providers that return structured records directly.
    const visionProviders: Array<() => Promise<{ records: ParsedGRFields[]; raw: string; mode: string; error?: string }>> = []
    if (isGeminiConfigured()) visionProviders.push(() => extractGRRecords(buffer))
    if (isMistralConfigured()) visionProviders.push(() => extractGRRecordsMistral(buffer))

    for (const run of visionProviders) {
      const r = await run()
      if (r.records.length > 0) {
        return NextResponse.json({
          records: r.records,
          text: r.raw,
          mode: r.mode,
          mock: false,
          error: null,
          warning: warnings.join(' | ') || null,
          ...fileMeta,
        })
      }
      if (r.error) warnings.push(`${r.mode}: ${r.error}`)
    }

    // 3: raw OCR text (OCR.space), then let Sarvam structure it.
    const ocr = await extractText(buffer)
    const hasText = !!ocr.text && ocr.text !== '(No text detected in image)'
    if (ocr.error) warnings.push(`ocr: ${ocr.error}`)

    if (hasText && isSarvamConfigured()) {
      const s = await structureWithSarvam(ocr.text)
      if (s.records.length > 0) {
        return NextResponse.json({
          records: s.records,
          text: ocr.text,
          mode: 'sarvam',
          mock: false,
          error: null,
          warning: warnings.join(' | ') || null,
          ...fileMeta,
        })
      }
      if (s.error) warnings.push(`sarvam: ${s.error}`)
    }

    // 4: no structured records anywhere — return raw text (client parses / manual
    // entry). Only a FATAL error when there is no usable text at all.
    return NextResponse.json({
      text: ocr.text,
      mode: ocr.mode,
      mock: ocr.mode === 'mock',
      error: hasText ? null : (ocr.error || warnings.join(' | ') || 'Could not extract any text from the image.'),
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

// GET — quick health check: which providers are active, in chain order.
export async function GET() {
  const chain: string[] = []
  if (isGeminiConfigured()) chain.push(`gemini (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})`)
  if (isMistralConfigured()) chain.push(`mistral (${process.env.MISTRAL_MODEL || 'mistral-small-latest'})`)
  if (isSarvamConfigured()) chain.push(`sarvam (${process.env.SARVAM_MODEL || 'sarvam-30b'}) — structures OCR text`)
  chain.push(isOcrMockMode() ? 'ocr.space (mock)' : 'ocr.space (raw text)')

  return NextResponse.json({
    status: 'ok',
    providers: chain,
    message:
      chain.length > 1
        ? `Extraction chain (tried in order until one succeeds): ${chain.join(' → ')}.`
        : 'Only OCR.space is configured. Add GEMINI_API_KEY / MISTRAL_API_KEY / SARVAM_API_KEY for accurate structured extraction.',
  })
}
