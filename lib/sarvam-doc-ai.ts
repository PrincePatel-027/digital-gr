/**
 * Sarvam Document AI — Sarvam Vision 1.5 document intelligence.
 *
 * Sarvam's Document AI (`doc_ai` namespace) is purpose-trained on Indic scripts —
 * including handwritten Gujarati — so it replaces OCR.space as the raw-text ANCHOR
 * the rest of the extraction chain is grounded against, and it adds a schema-based
 * EXTRACT strategy that pulls structured student records straight from the image.
 *
 * This is a DIFFERENT product from `lib/sarvam-structure.ts`: that module calls the
 * general chat-completions API (`sarvam-30b`) to structure text something else already
 * transcribed. Document AI is vision-native and OCR-specialised. Both coexist and both
 * authenticate with the same `SARVAM_API_KEY` (sent as `api-subscription-key`).
 *
 * Job lifecycle (all under https://api.sarvam.ai/doc-ai/v1/job):
 *   POST /digitise | /extract           → { job_id, status, run_id }   (multipart)
 *   GET  /{job_id}/status               → { status, usage, ... }        (poll to terminal)
 *   GET  /{job_id}/results?format=json  → { result, documents, ... }    (terminal only; 409 if early)
 *
 * Docs: https://docs.sarvam.ai/api/api-guides-tutorials/document-intelligence/overview
 */

import type { ParsedGRFields } from './ocr-parser'
import {
  STRING_FIELDS,
  FIELD_DESCRIPTIONS,
  toParsedRecords,
  extractStudentsArray,
  fetchWithRetry,
} from './extract-shared'
import { preprocessForOcr } from './image-prep'

// ── Config ────────────────────────────────────────────────────
const BASE_URL = 'https://api.sarvam.ai/doc-ai/v1/job'
const AUTH_HEADER = 'api-subscription-key'

// Both pages of a GR are Gujarati. BCP-47 code per Sarvam docs.
const DOC_LANGUAGE = 'gu-IN'

// GR pages are handwritten forms. Sarvam's dashboard exposes Printed | Handwritten |
// Mixed, so "handwritten" is the natural API value and should lift accuracy. It is
// overridable, and if the account/model rejects the value we self-heal (see below),
// so a wrong enum degrades to Sarvam's own default rather than all the way to OCR.space.
const CONTENT_TYPE = process.env.SARVAM_DOC_AI_CONTENT_TYPE ?? 'handwritten'

// Optional model override; Sarvam defaults to sarvam-vision-v1 when omitted.
const DOC_MODEL = process.env.SARVAM_DOC_AI_MODEL || ''

// Polling: start ~2s, grow to a ~5s cap, give up after a hard total budget.
const POLL_START_MS = 2000
const POLL_MAX_MS = 5000
const JOB_TIMEOUT_MS = 45_000

const TERMINAL = new Set(['completed', 'partially_completed', 'failed', 'rejected'])
const SUCCESS = new Set(['completed', 'partially_completed'])

export function isSarvamDocAiConfigured(): boolean {
  return !!process.env.SARVAM_API_KEY
}

// ── Errors ────────────────────────────────────────────────────
class SarvamHttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'SarvamHttpError'
  }
}

/**
 * Categorise a Sarvam failure in the same style as OCR.space's `describeOcrFailure`
 * (in lib/ocr.ts), so logs/warnings read consistently. The UI's failure messaging is
 * generic and does not parse these categories.
 */
function describeSarvamFailure(status: number, body: string): string {
  const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 200)
  const tail = snippet ? ` — ${snippet}` : ''
  if (status === 429) return `rate-limit — Sarvam ${status}${tail}`
  if (status === 401 || status === 402 || status === 403) return `auth/billing — Sarvam ${status}${tail}`
  if (status === 503) return `billing/unavailable — Sarvam ${status}${tail}`
  if (status === 409) return `too-early — Sarvam ${status}${tail}`
  if (status === 404) return `not-found — Sarvam ${status}${tail}`
  if (status === 400 || status === 413 || status === 422) return `bad-request — Sarvam ${status}${tail}`
  if (status >= 500) return `timeout/server — Sarvam ${status}${tail}`
  return `Sarvam ${status}${tail}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Rate limiter (token bucket) ───────────────────────────────
// Document AI allows only 10 requests/minute, account-wide across ALL keys, and every
// job spans several requests (create + N status polls + results). A single upload can
// fan out to multiple digitise/extract jobs, and two staff uploading at once multiplies
// that — so every doc-ai HTTP call passes through this in-process bucket. It permits an
// initial burst of 10 (a lone upload sails through un-throttled) then refills one token
// every 6s, so sustained load is capped at the limit instead of erroring. `fetchWithRetry`
// still backs off on any 429 that slips past (e.g. across server processes/instances).
const RATE_CAPACITY = 10
const REFILL_MS = 60_000 / RATE_CAPACITY // one token every 6s
const MAX_TOKEN_WAIT_MS = 30_000

let tokens = RATE_CAPACITY
let lastRefill = Date.now()

function refillTokens() {
  const elapsed = Date.now() - lastRefill
  if (elapsed < REFILL_MS) return
  const gained = Math.floor(elapsed / REFILL_MS)
  tokens = Math.min(RATE_CAPACITY, tokens + gained)
  lastRefill += gained * REFILL_MS
}

// Single-threaded JS makes the refill→check→decrement below atomic (no await between
// them), so concurrent waiters cannot double-spend a token.
async function acquireToken(): Promise<void> {
  const deadline = Date.now() + MAX_TOKEN_WAIT_MS
  for (;;) {
    refillTokens()
    if (tokens >= 1) {
      tokens -= 1
      return
    }
    if (Date.now() >= deadline) {
      throw new SarvamHttpError(429, 'rate-limit — Sarvam Document AI 10 req/min budget exhausted; try again shortly.')
    }
    const untilNext = REFILL_MS - (Date.now() - lastRefill)
    await sleep(Math.max(50, Math.min(untilNext, deadline - Date.now())))
  }
}

/** Rate-gated fetch with transient-error backoff, for every doc-ai request. */
async function docAiFetch(url: string, init: RequestInit): Promise<Response> {
  await acquireToken()
  return fetchWithRetry(url, init)
}

function apiKeyOrThrow(): string {
  const key = process.env.SARVAM_API_KEY
  if (!key) throw new SarvamHttpError(401, 'auth — SARVAM_API_KEY not configured')
  return key
}

// ── Upload normalisation ──────────────────────────────────────
// Sarvam Document AI accepts PDF, PNG and JPG only (not WebP/TIFF). PDFs pass through
// untouched; every other raster input is auto-oriented and re-encoded to JPEG via sharp
// (mirroring gemini-extract / mistral-extract), which also covers WebP/TIFF uploads.
interface Upload { buf: Buffer; name: string; mime: string }

function looksLikePdf(buf: Buffer, filename: string): boolean {
  if (/\.pdf$/i.test(filename)) return true
  return buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-'
}

async function toUpload(buffer: Buffer, filename: string): Promise<Upload> {
  if (looksLikePdf(buffer, filename)) {
    return { buf: buffer, name: /\.pdf$/i.test(filename) ? filename : 'document.pdf', mime: 'application/pdf' }
  }
  const jpeg = await preprocessForOcr(buffer)
  return { buf: jpeg, name: 'page.jpg', mime: 'image/jpeg' }
}

function fileField(upload: Upload): Blob {
  // Fresh Uint8Array over its own ArrayBuffer → a clean BlobPart regardless of how the
  // Node Buffer was allocated.
  return new Blob([new Uint8Array(upload.buf)], { type: upload.mime })
}

// ── Job lifecycle helpers ─────────────────────────────────────
async function createJob(kind: 'digitise' | 'extract', form: FormData): Promise<string> {
  const res = await docAiFetch(`${BASE_URL}/${kind}`, {
    method: 'POST',
    headers: { [AUTH_HEADER]: apiKeyOrThrow() },
    body: form,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new SarvamHttpError(res.status, describeSarvamFailure(res.status, body))
  }
  const data = await res.json().catch(() => ({}))
  const jobId = data?.job_id
  if (!jobId || typeof jobId !== 'string') {
    throw new Error(`Sarvam ${kind}: response contained no job_id`)
  }
  return jobId
}

/** Poll a job to a terminal state; throw on failed/rejected/timeout. */
async function pollUntilTerminal(jobId: string): Promise<void> {
  const deadline = Date.now() + JOB_TIMEOUT_MS
  let interval = POLL_START_MS
  for (;;) {
    if (Date.now() >= deadline) {
      throw new Error(`timeout — Sarvam job ${jobId} did not reach a terminal state within ${Math.round(JOB_TIMEOUT_MS / 1000)}s`)
    }
    await sleep(Math.min(interval, Math.max(0, deadline - Date.now())))
    interval = Math.min(POLL_MAX_MS, interval + 1000)

    const res = await docAiFetch(`${BASE_URL}/${jobId}/status`, {
      method: 'GET',
      headers: { [AUTH_HEADER]: apiKeyOrThrow() },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new SarvamHttpError(res.status, describeSarvamFailure(res.status, body))
    }
    const data = await res.json().catch(() => ({}))
    const status = String(data?.status || '').toLowerCase()
    if (SUCCESS.has(status)) return
    if (TERMINAL.has(status)) {
      // failed | rejected
      const failed = data?.usage?.pages_failed
      throw new Error(`Sarvam job ${status} (${jobId})${failed ? ` — ${failed} page(s) failed` : ''}`)
    }
    // pending | running → keep polling
  }
}

async function getResults(jobId: string): Promise<unknown> {
  const res = await docAiFetch(`${BASE_URL}/${jobId}/results?format=json`, {
    method: 'GET',
    headers: { [AUTH_HEADER]: apiKeyOrThrow() },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new SarvamHttpError(res.status, describeSarvamFailure(res.status, body))
  }
  return res.json()
}

// ── Digitise: full-page OCR (raw-text anchor) ─────────────────
/**
 * Transcribe a page with Sarvam Document AI (Digitise) and return the text as a plain
 * string — the same shape `callOcrSpace` produces, so it drops straight into
 * `extractText`'s merge logic in lib/ocr.ts.
 *
 * Note on retrieval: the digitise JSON results (fetched via the confirmed `/results`
 * endpoint) already carry the page's text blocks, so we read the transcription from
 * there. That avoids a second `/download-url` round-trip + unzipping a ZIP just to reach
 * the Markdown file, keeps the output as plain reading-order text (what the anchor is),
 * and adds no ZIP dependency.
 */
export async function digitiseWithSarvam(buffer: Buffer, filename: string): Promise<string> {
  apiKeyOrThrow()
  const upload = await toUpload(buffer, filename)

  const buildForm = (withContentType: boolean): FormData => {
    const form = new FormData()
    form.append('file', fileField(upload), upload.name)
    form.append('language', DOC_LANGUAGE)
    form.append('output_format', 'md')
    form.append('auto_orient', 'true')
    if (withContentType && CONTENT_TYPE) form.append('content_type', CONTENT_TYPE)
    if (DOC_MODEL) form.append('model', DOC_MODEL)
    return form
  }

  let jobId: string
  try {
    jobId = await createJob('digitise', buildForm(true))
  } catch (err) {
    // Self-heal: if `content_type` is what the API rejected (400), retry once without it
    // so a wrong enum value falls back to Sarvam's default instead of to OCR.space.
    if (CONTENT_TYPE && err instanceof SarvamHttpError && err.status === 400) {
      console.warn(`Sarvam digitise rejected content_type="${CONTENT_TYPE}" (400); retrying without it.`)
      jobId = await createJob('digitise', buildForm(false))
    } else {
      throw err
    }
  }

  await pollUntilTerminal(jobId)
  const results = await getResults(jobId)
  const text = extractDigitiseText(results).trim()
  if (!text) throw new Error('Sarvam digitise returned no text')
  return text
}

/**
 * Pull the page transcription out of a digitise results payload without assuming an
 * exact nesting: prefer an explicit top-level markdown/text field, otherwise walk the
 * `documents` tree collecting each block's text in reading order.
 */
function extractDigitiseText(results: unknown): string {
  if (!results || typeof results !== 'object') return ''
  const root = results as Record<string, unknown>

  for (const key of ['markdown', 'md', 'content', 'text']) {
    const v = root[key]
    if (typeof v === 'string' && v.trim()) return v
  }

  const parts: string[] = []
  const seen = new WeakSet<object>()
  const visit = (node: unknown) => {
    if (node == null) return
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }
    if (typeof node !== 'object') return
    if (seen.has(node as object)) return
    seen.add(node as object)

    const rec = node as Record<string, unknown>
    // Take the first text-bearing value on this node (avoid duplicating the same block).
    for (const key of ['markdown', 'md', 'content', 'text']) {
      const v = rec[key]
      if (typeof v === 'string' && v.trim()) {
        parts.push(v.trim())
        break
      }
    }
    // Recurse into structural containers only.
    for (const key of ['documents', 'pages', 'blocks', 'sections', 'elements', 'items', 'data', 'result']) {
      if (rec[key] != null) visit(rec[key])
    }
  }
  visit(root.documents ?? root)

  // Drop consecutive duplicates (a block's text can surface under more than one key).
  const out: string[] = []
  for (const p of parts) if (p !== out[out.length - 1]) out.push(p)
  return out.join('\n')
}

// ── Extract: schema-based key/value extraction ────────────────
// Built from the SAME canonical STRING_FIELDS + FIELD_DESCRIPTIONS as every other
// provider, wrapped in a `students` array. Schema rules (Sarvam): root is an object with
// non-empty properties, every field needs a type + non-empty description, max nesting
// depth 4 (object → students array → item object → field = 4). No `required` (Sarvam's
// examples omit it).
function buildExtractSchema(): string {
  const studentProps: Record<string, { type: string; description: string }> = {}
  for (const f of STRING_FIELDS) {
    studentProps[f] = { type: 'string', description: FIELD_DESCRIPTIONS[f] }
  }
  const schema = {
    type: 'object',
    properties: {
      students: {
        type: 'array',
        description:
          'One entry per student — i.e. per numbered register row on the page. Extract EVERY student. Skip printed column headers and any blank or "નમુનો" (specimen/sample) row. Each row with its own register number is a separate student. Never invent or "correct" a value: if you cannot read a field with confidence, return an empty string for it.',
        items: {
          type: 'object',
          description: 'A single student record from one register row.',
          properties: studentProps,
        },
      },
    },
  }
  return JSON.stringify(schema)
}

/**
 * Extract structured GR records directly from the image via Sarvam Document AI (Extract).
 * Vision-native and Gujarati-specialised, so it needs no separate OCR transcription. The
 * result is mapped through the shared `toParsedRecords` sanitizer, so confidence-marking
 * and the admission/leaving disambiguation stay centralised.
 */
export async function extractGRRecordsSarvamDocAI(
  buffer: Buffer,
  filename: string
): Promise<ParsedGRFields[]> {
  apiKeyOrThrow()
  const upload = await toUpload(buffer, filename)

  const form = new FormData()
  form.append('file', fileField(upload), upload.name)
  form.append('schema', buildExtractSchema())
  form.append('language', DOC_LANGUAGE)
  form.append('output_format', 'json')
  form.append('auto_orient', 'true')
  if (DOC_MODEL) form.append('model', DOC_MODEL)

  const jobId = await createJob('extract', form)
  await pollUntilTerminal(jobId)
  const results = await getResults(jobId)

  // Extract results carry the schema-shaped object under `result` → { students: [...] }.
  const result = (results as { result?: unknown })?.result
  const students = extractStudentsArray(result)
  // Direct vision read (like Gemini/Mistral) → base confidence 'high'; sanitizeRecord
  // downgrades genuinely ambiguous fields to 'medium'.
  return toParsedRecords(students, 'high')
}
