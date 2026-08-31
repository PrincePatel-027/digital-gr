import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runOcrPipeline } from '@/lib/ocr-pipeline'
import {
  assessRegisterImage,
  reconstructRegisterScan,
} from '@/lib/reconstruct-register'
import {
  GUIDED_SCAN_LAYOUT,
  GUIDED_SCAN_TILE_COUNT,
} from '@/lib/ocr-types'
import { authorizeRequest, RequestAuthError, type AppRole } from '@/lib/server-auth'

export const runtime = 'nodejs'
// Declared rather than inherited: runOcrPipeline holds its own, smaller budget, so the
// handler answers with a real JSON error before the platform can kill it mid-run.
export const maxDuration = 300

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_ROLES = new Set<AppRole>(['school_admin', 'staff'])
// Vercel rejects a request body over ~4.5 MB at the edge, answering a bare 413 before
// this handler ever runs. Keeping our own ceilings under that line is what turns an
// oversized scan into an actionable message instead of an opaque platform error.
const MAX_FILE_BYTES = 2 * 1024 * 1024
const MAX_TOTAL_BYTES = 4 * 1024 * 1024 + 256 * 1024

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

function requireFile(formData: FormData, field: string): File {
  const entries = formData.getAll(field)
  if (entries.length !== 1 || typeof entries[0] === 'string') {
    throw new HttpError(`Expected exactly one image field "${field}".`, 400)
  }

  const entry = entries[0]
  if (!ACCEPTED_IMAGE_TYPES.has(entry.type)) {
    throw new HttpError(
      `${field} has unsupported type ${entry.type || 'unknown'}. Use JPEG, PNG, or WebP.`,
      400
    )
  }
  if (entry.size === 0 || entry.size > MAX_FILE_BYTES) {
    throw new HttpError(`${field} must be between 1 byte and 2 MB.`, 400)
  }
  return entry
}

export async function POST(req: NextRequest) {
  try {
    const { admin, schoolId } = await authorizeRequest(req, ALLOWED_ROLES)
    if (!schoolId) throw new RequestAuthError('A school-linked profile is required.', 403)

    const formData = await req.formData()
    const allowedFields = new Set([
      'layout',
      'overview',
      ...Array.from({ length: GUIDED_SCAN_TILE_COUNT }, (_, index) => `tile${index}`),
    ])
    for (const field of formData.keys()) {
      if (!allowedFields.has(field)) throw new HttpError(`Unexpected form field "${field}".`, 400)
    }
    if (formData.getAll('layout').length !== 1 || formData.get('layout') !== GUIDED_SCAN_LAYOUT) {
      throw new HttpError(`Unsupported scan layout. Expected ${GUIDED_SCAN_LAYOUT}.`, 400)
    }

    const overview = requireFile(formData, 'overview')
    const tiles = Array.from({ length: GUIDED_SCAN_TILE_COUNT }, (_, index) =>
      requireFile(formData, `tile${index}`)
    )
    const allFiles = [overview, ...tiles]
    const totalBytes = allFiles.reduce((sum, file) => sum + file.size, 0)
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new HttpError('Combined scan is too large. Maximum upload is 4.25 MB.', 400)
    }

    // Keep decoded-image concurrency bounded. request.formData() already materializes
    // multipart entries, so avoid simultaneously cloning and decoding all seven files.
    const overviewBuffer = Buffer.from(await overview.arrayBuffer())
    const overviewQuality = await assessRegisterImage(overviewBuffer, 'overview')
    const tileBuffers: Buffer[] = []
    for (const tile of tiles) tileBuffers.push(Buffer.from(await tile.arrayBuffer()))
    const reconstructed = await reconstructRegisterScan(tileBuffers)

    // OCR first, storage second: a provider/pipeline exception cannot leave an object
    // that no record can ever claim.
    const ocr = await runOcrPipeline(reconstructed.buffer, {
      fileName: 'guided-register-scan.jpg',
      fileSize: reconstructed.buffer.length,
      fileType: 'image/jpeg',
    })

    const storagePath = `${schoolId}/guided-${Date.now()}-${randomUUID()}.jpg`
    const { error: uploadError } = await admin.storage
      .from('gr-images')
      .upload(storagePath, reconstructed.buffer, {
        cacheControl: '3600',
        contentType: 'image/jpeg',
        upsert: false,
      })
    if (uploadError) {
      throw new HttpError(`Could not store reconstructed scan: ${uploadError.message}`, 500)
    }

    const scanWarnings = [overviewQuality, ...reconstructed.tiles]
      .flatMap((quality) => quality.warnings.map((warning) => `${quality.label}: ${warning}`))

    return NextResponse.json({
      ...ocr,
      scan: {
        storagePath,
        layout: reconstructed.layout,
        width: reconstructed.width,
        height: reconstructed.height,
        overview: overviewQuality,
        tiles: reconstructed.tiles,
        warnings: scanWarnings,
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const status = error instanceof HttpError || error instanceof RequestAuthError
      ? error.status
      : 500
    const message = error instanceof Error ? error.message : String(error)
    if (status >= 500) console.error('Guided scan endpoint error:', message)
    return NextResponse.json({ error: message }, { status })
  }
}
