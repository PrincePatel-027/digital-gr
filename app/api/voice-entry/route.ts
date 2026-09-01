import { NextRequest, NextResponse } from 'next/server'
import { isVoiceGroupId } from '@/lib/voice-fields'
import {
  getVoiceHealth,
  getVoiceMaxEntries,
  isVoiceCompareEnabled,
  runMultiVoicePipeline,
  runVoiceComparison,
  runVoicePipeline,
  VoicePipelineError,
} from '@/lib/voice-pipeline'
import type { VoiceEntryMode, VoiceLanguage } from '@/lib/voice-types'
import { authorizeRequest, RequestAuthError, type AppRole } from '@/lib/server-auth'

export const runtime = 'nodejs'
// Multi-student recordings may need the adapter's full 180-second timeout.
// Verify that the deployed Vercel plan permits this duration before production rollout.
export const maxDuration = 300

const ALLOWED_ROLES = new Set<AppRole>(['school_admin', 'staff'])
const ALLOWED_FORM_FIELDS = new Set([
  'audio',
  'mode',
  'group',
  'expectedCount',
  'language',
])
const VALID_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
])
const MAX_AUDIO_BYTES = 10 * 1024 * 1024
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_REQUESTS = 12

interface RateBucket {
  startedAt: number
  count: number
}

type GlobalWithVoiceRateLimit = typeof globalThis & {
  __digitalGrVoiceRateBuckets?: Map<string, RateBucket>
}

const rateBuckets = (
  globalThis as GlobalWithVoiceRateLimit
).__digitalGrVoiceRateBuckets ?? new Map<string, RateBucket>()
;(globalThis as GlobalWithVoiceRateLimit).__digitalGrVoiceRateBuckets = rateBuckets

class VoiceRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly headers?: Record<string, string>
  ) {
    super(message)
    this.name = 'VoiceRequestError'
  }
}

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

function enforceRateLimit(userId: string): void {
  const now = Date.now()
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key)
  }

  const current = rateBuckets.get(userId)
  if (!current) {
    rateBuckets.set(userId, { startedAt: now, count: 1 })
    return
  }
  if (current.count >= RATE_LIMIT_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.startedAt)) / 1000)
    )
    throw new VoiceRequestError(
      'Too many voice-entry requests. Wait before recording another group.',
      429,
      { 'Retry-After': String(retryAfterSeconds) }
    )
  }
  current.count += 1
}

function singleTextField(formData: FormData, name: string, required: boolean): string | null {
  const all = formData.getAll(name)
  if (all.length > 1) throw new VoiceRequestError(`Send only one "${name}" field.`, 400)
  const value = all[0]
  if (value === undefined) {
    if (required) throw new VoiceRequestError(`Missing form field: ${name}.`, 400)
    return null
  }
  if (typeof value !== 'string') {
    throw new VoiceRequestError(`Form field "${name}" must be text.`, 400)
  }
  const trimmed = value.trim()
  if (required && !trimmed) throw new VoiceRequestError(`Form field "${name}" cannot be empty.`, 400)
  return trimmed || null
}

function optionalExpectedCount(formData: FormData, maxEntries: number): number | null {
  const values = formData.getAll('expectedCount')
  if (values.length > 1) {
    throw new VoiceRequestError('Send only one "expectedCount" field.', 400)
  }
  if (values.length === 0) return null

  const value = values[0]
  const message = `Form field "expectedCount" must be an integer from 1 to ${maxEntries}.`
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) {
    throw new VoiceRequestError(message, 400)
  }

  const count = Number(value.trim())
  if (!Number.isSafeInteger(count) || count < 1 || count > maxEntries) {
    throw new VoiceRequestError(message, 400)
  }
  return count
}

async function parseMultipart(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    throw new VoiceRequestError('Malformed multipart form data.', 400)
  }

  for (const name of formData.keys()) {
    if (!ALLOWED_FORM_FIELDS.has(name)) {
      throw new VoiceRequestError(`Unexpected form field: ${name}.`, 400)
    }
  }

  const audioEntries = formData.getAll('audio')
  if (audioEntries.length !== 1 || typeof audioEntries[0] === 'string') {
    throw new VoiceRequestError('Send exactly one audio file in the "audio" field.', 400)
  }
  const audio = audioEntries[0]
  if (audio.size === 0) throw new VoiceRequestError('The audio file is empty.', 400)
  if (audio.size > MAX_AUDIO_BYTES) {
    throw new VoiceRequestError('Audio file too large. Maximum size is 10 MB.', 400)
  }

  const baseMimeType = audio.type.split(';', 1)[0].trim().toLowerCase()
  if (!VALID_AUDIO_TYPES.has(baseMimeType)) {
    throw new VoiceRequestError(
      `Unsupported audio type: ${audio.type || '(missing)'}. Accepted: WebM, MP4/M4A, MP3, WAV, OGG.`,
      400
    )
  }

  const suppliedMode = singleTextField(formData, 'mode', false)
  if (formData.has('mode') && suppliedMode === null) {
    throw new VoiceRequestError('Unknown voice entry mode: (empty).', 400)
  }
  if (suppliedMode !== null && suppliedMode !== 'single' && suppliedMode !== 'multi') {
    throw new VoiceRequestError(`Unknown voice entry mode: ${suppliedMode}.`, 400)
  }
  const mode: VoiceEntryMode = suppliedMode ?? 'single'
  const groupValue = singleTextField(formData, 'group', false)

  const languageValue = singleTextField(formData, 'language', false) || 'en-IN'
  if (languageValue !== 'en-IN') {
    throw new VoiceRequestError('Voice entry currently supports only en-IN.', 400)
  }

  const common = {
    audio: Buffer.from(await audio.arrayBuffer()),
    mimeType: audio.type || baseMimeType,
    language: languageValue as VoiceLanguage,
  }

  if (mode === 'single') {
    if (formData.has('expectedCount')) {
      throw new VoiceRequestError(
        'Form field "expectedCount" is allowed only in multi mode.',
        400
      )
    }
    if (!groupValue) throw new VoiceRequestError('Missing form field: group.', 400)
    if (!isVoiceGroupId(groupValue)) {
      throw new VoiceRequestError(`Unknown voice group: ${groupValue}.`, 400)
    }
    return { ...common, mode, group: groupValue }
  }

  if (formData.has('group')) {
    throw new VoiceRequestError('Form field "group" is not allowed in multi mode.', 400)
  }
  const expectedCount = optionalExpectedCount(formData, getVoiceMaxEntries())
  return { ...common, mode, expectedCount }
}

export async function POST(req: NextRequest) {
  try {
    // This endpoint spends paid Gemini quota. Authorization and the per-user quota
    // gate deliberately run before multipart parsing or reading the audio bytes.
    const auth = await authorizeRequest(req, ALLOWED_ROLES)
    enforceRateLimit(auth.userId)

    const input = await parseMultipart(req)
    const compareRequested = req.nextUrl.searchParams.get('debug') === 'all'
    if (compareRequested && isVoiceCompareEnabled()) {
      const comparisonOptions = input.mode === 'single'
        ? {
            mode: 'single' as const,
            group: input.group,
            language: input.language,
            signal: req.signal,
          }
        : {
            mode: 'multi' as const,
            expectedCount: input.expectedCount,
            language: input.language,
            signal: req.signal,
          }
      const result = await runVoiceComparison(
        input.audio,
        input.mimeType,
        comparisonOptions
      )
      if (result.results.length === 0) {
        throw new VoiceRequestError(
          'Voice compare mode is enabled, but no audio model is configured.',
          503
        )
      }
      return json(result)
    }

    const result = input.mode === 'single'
      ? await runVoicePipeline(
          input.audio,
          input.mimeType,
          input.group,
          input.language,
          { signal: req.signal }
        )
      : await runMultiVoicePipeline(
          input.audio,
          input.mimeType,
          input.expectedCount,
          input.language,
          { signal: req.signal }
        )
    return json(result)
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return json({ error: error.message }, error.status)
    }
    if (error instanceof VoiceRequestError) {
      return json({ error: error.message }, error.status, error.headers)
    }
    if (error instanceof VoicePipelineError) {
      console.error('Voice pipeline error:', error.message)
      return json({ error: error.message }, 502)
    }

    const message = error instanceof Error ? error.message : String(error)
    console.error('Voice entry endpoint error:', message)
    return json({ error: 'Voice entry processing failed.' }, 500)
  }
}

// Health contains no student data and spends no provider quota.
export async function GET() {
  return json(getVoiceHealth())
}
