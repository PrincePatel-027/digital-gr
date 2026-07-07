import { NextRequest, NextResponse } from 'next/server'
import { extractText, isOcrMockMode } from '@/lib/ocr'
import { extractGRRecords, isGeminiConfigured } from '@/lib/gemini-extract'



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

    // ── Primary path: Gemini vision → structured records (any layout) ──
    // Reads the image directly and returns per-student fields as JSON. Falls back
    // to OCR.space raw-text OCR if Gemini isn't configured or returns nothing.
    if (isGeminiConfigured()) {
      const g = await extractGRRecords(buffer)
      if (g.records.length > 0) {
        return NextResponse.json({
          records: g.records,
          text: g.raw,
          mode: g.mode,
          mock: false,
          error: null,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        })
      }
      // Gemini configured but produced no records — fall through to OCR.space,
      // surfacing the Gemini error so the client can show something useful.
      const ocr = await extractText(buffer)
      return NextResponse.json({
        text: ocr.text,
        mode: ocr.mode,
        mock: ocr.mode === 'mock',
        error: ocr.error || g.error || null,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      })
    }

    const result = await extractText(buffer)

    return NextResponse.json({
      text: result.text,
      mode: result.mode,
      mock: result.mode === 'mock',
      error: result.error || null,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
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

// GET — quick health check
export async function GET() {
  if (isGeminiConfigured()) {
    return NextResponse.json({
      status: 'ok',
      mode: 'gemini',
      message: `Gemini vision extraction configured (model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}). OCR.space is the fallback.`,
    })
  }
  return NextResponse.json({
    status: 'ok',
    mode: isOcrMockMode() ? 'mock' : 'real',
    message: isOcrMockMode()
      ? 'Running in MOCK mode — no OCR_SPACE_API_KEY configured. Get a free key at https://ocr.space/ocrapi/freekey'
      : 'Real OCR.space API configured (Gujarati + English dual-pass). Set GEMINI_API_KEY to use Gemini vision instead.',
  })
}
