import { NextRequest, NextResponse } from 'next/server'
import {
  getOcrHealth,
  isOcrCompareEnabled,
  runOcrComparison,
  runOcrPipeline,
} from '@/lib/ocr-pipeline'
import { authorizeRequest, RequestAuthError, type AppRole } from '@/lib/server-auth'

export const runtime = 'nodejs'
// Declared rather than inherited: the pipeline holds its own, smaller budget, so the
// handler answers with a real JSON error before the platform can kill it mid-run.
export const maxDuration = 300

const ALLOWED_ROLES = new Set<AppRole>(['school_admin', 'staff'])
// Vercel rejects a request body over ~4.5 MB at the edge with a bare 413, and callers
// here post original camera files unchanged, which routinely exceed that. Rejecting
// just under the platform line keeps the reason visible to the operator.
const MAX_FILE_BYTES = 4 * 1024 * 1024 + 256 * 1024
const VALID_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'application/pdf',
])

export async function POST(req: NextRequest) {
  try {
    // This endpoint can spend paid provider quota. Dashboard client redirects are not
    // authorization, so verify the bearer token before parsing or processing the body.
    await authorizeRequest(req, ALLOWED_ROLES)

    const formData = await req.formData()
    const entry = formData.get('image')

    if (!entry || typeof entry === 'string') {
      return NextResponse.json(
        { error: 'No image file provided. Send a form field named "image".' },
        { status: 400 }
      )
    }
    if (!VALID_TYPES.has(entry.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${entry.type}. Accepted: JPG, PNG, WebP, TIFF, PDF.` },
        { status: 400 }
      )
    }
    if (entry.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 4.25 MB.' }, { status: 400 })
    }

    const buffer = Buffer.from(await entry.arrayBuffer())
    const fileMeta = {
      fileName: entry.name,
      fileSize: entry.size,
      fileType: entry.type,
    }
    const compareMode =
      req.nextUrl.searchParams.get('debug') === 'all' && isOcrCompareEnabled()

    if (compareMode) {
      const result = await runOcrComparison(buffer, fileMeta)
      if (result.results.length === 0) {
        return NextResponse.json(
          { error: 'Compare mode is enabled, but no vision extraction provider is configured.' },
          { status: 503 }
        )
      }
      return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
    }

    const result = await runOcrPipeline(buffer, fileMeta)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const status = error instanceof RequestAuthError ? error.status : 500
    const message = error instanceof Error ? error.message : String(error)
    if (status >= 500) console.error('OCR endpoint error:', message)
    return NextResponse.json(
      { error: status >= 500 && !(error instanceof RequestAuthError) ? `Server error: ${message}` : message },
      { status }
    )
  }
}

// Health contains no student data and performs no paid OCR work, so it remains public.
export async function GET() {
  return NextResponse.json(getOcrHealth(), { headers: { 'Cache-Control': 'no-store' } })
}
