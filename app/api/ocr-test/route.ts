import { NextRequest, NextResponse } from 'next/server'
import { extractText, isOcrMockMode } from '@/lib/ocr'



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
  return NextResponse.json({
    status: 'ok',
    mode: isOcrMockMode() ? 'mock' : 'real',
    message: isOcrMockMode()
      ? 'Running in MOCK mode — no OCR_SPACE_API_KEY configured. Get a free key at https://ocr.space/ocrapi/freekey'
      : 'Real OCR.space API configured (Gujarati + English dual-pass).',
  })
}
