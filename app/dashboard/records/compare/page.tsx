'use client'

/**
 * OCR engine comparison — a diagnostic tool to find the best reader for handwritten
 * Gujarati GR pages. Upload a scan; it POSTs to /api/ocr-test?debug=all and shows every
 * configured engine's extracted fields side by side against the image, so you can see
 * which one reads the handwriting most accurately before locking it into production.
 *
 * Requires OCR_DEBUG_COMPARE=1 in the server env. This page is additive and does not
 * touch the production New Record form.
 */

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import type { ParsedGRFields, ParsedField } from '@/lib/ocr-parser'

interface EngineResult {
  source: string
  model: string
  count: number
  records: ParsedGRFields[]
  ms: number
  error: string | null
}
interface CompareResponse {
  mode?: string
  anchorText?: string
  anchorError?: string | null
  results?: EngineResult[]
  warning?: string | null
  error?: string
  fileName?: string
}

// Field order + short bilingual labels for the comparison table.
const FIELDS: [keyof ParsedGRFields, string][] = [
  ['gr_number', 'GR નં / GR no'],
  ['student_name', 'નામ / Name'],
  ['fathers_name', 'પિતા / Father'],
  ['mothers_name', 'માતા / Mother'],
  ['surname', 'અટક / Surname'],
  ['religion', 'ધર્મ / Religion'],
  ['caste_category', 'જ્ઞાતિ / Caste'],
  ['date_of_birth', 'જન્મ તા. / DOB'],
  ['dob_in_words', 'જન્મ (શબ્દ) / DOB words'],
  ['birth_place', 'જન્મ સ્થળ / Birthplace'],
  ['address', 'ગામ / Address'],
  ['previous_school', 'છેલ્લી શાળા / Prev. school'],
  ['admission_date', 'દાખલ તા. / Adm. date'],
  ['admission_standard', 'દાખલ ધો. / Adm. std'],
  ['progress_and_conduct', 'પ્રગતિ / Progress'],
  ['leaving_date', 'છોડ્યા તા. / Leaving date'],
  ['leaving_reason', 'કારણ / Leave reason'],
  ['leaving_standard', 'છોડ્યા ધો. / Leaving std'],
  ['remarks', 'શેરો / Remarks'],
]

function dot(confidence?: ParsedField['confidence']) {
  if (confidence === 'high') return 'bg-success'
  if (confidence === 'medium') return 'bg-warning'
  if (confidence === 'low') return 'bg-error'
  return 'bg-transparent'
}

export default function OcrComparePage() {
  const { session } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CompareResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recordIdx, setRecordIdx] = useState(0)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setData(null)
    setRecordIdx(0)
    setPreview(URL.createObjectURL(file))
    setLoading(true)
    try {
      if (!session?.access_token) throw new Error('Your session has expired. Sign in again before comparing engines.')
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/ocr-test?debug=all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })
      const json: CompareResponse = await res.json()
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
      if (!json.results || json.results.length === 0) {
        throw new Error(
          json.mode === 'compare'
            ? 'No engines returned.'
            : 'Compare mode is off. Set OCR_DEBUG_COMPARE=1 in the server env and restart the dev server.'
        )
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const results = data?.results ?? []

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/records" className="text-sm text-ink-soft hover:text-ink inline-flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to records
        </Link>
        <h1 className="text-3xl sm:text-4xl mt-3">Compare OCR engines</h1>
        <p className="text-sm text-ink-soft mt-2 max-w-2xl">
          Upload a register page to see how each configured reader (Sarvam Doc AI, Gemini
          2.5/3.1 Pro, GPT-5, Mistral) extracts the fields — side by side against the scan.
          Green/amber/red dots show each field&apos;s confidence. Diagnostic only; nothing is saved.
        </p>
      </div>

      <div>
        <button onClick={() => fileRef.current?.click()} className="neu-btn neu-btn-accent" disabled={loading}>
          {loading ? 'Reading with all engines…' : 'Upload a scan to compare'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/tiff,application/pdf"
          capture="environment"
          onChange={onFile}
          className="sr-only"
        />
      </div>

      {error && (
        <div className="neu-card-flat p-4" style={{ borderColor: '#a8322b' }}>
          <p className="text-sm font-semibold text-error">{error}</p>
        </div>
      )}

      {(preview || results.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-5 items-start">
          {/* The scan (sticky so you can scroll the table against it) */}
          <div className="lg:sticky lg:top-20 space-y-4">
            {preview && (
              <div className="neu-card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Uploaded register page" className="w-full h-auto object-contain bg-surface-2" />
              </div>
            )}
            {loading && (
              <div className="flex items-center gap-3 text-ink-soft text-sm">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running every engine (this can take a while)…
              </div>
            )}
            {data?.anchorText && (
              <details className="neu-card p-4">
                <summary className="text-sm font-semibold cursor-pointer">Raw transcription (anchor)</summary>
                <pre className="whitespace-pre-wrap text-xs text-ink-soft mt-3 max-h-72 overflow-y-auto text-mono leading-relaxed">
                  {data.anchorText}
                </pre>
              </details>
            )}
          </div>

          {/* Side-by-side field comparison */}
          {results.length > 0 && (
            <div className="space-y-3 overflow-x-auto">
              {/* Max records across engines → let the user step through multi-student pages */}
              <RecordStepper results={results} recordIdx={recordIdx} setRecordIdx={setRecordIdx} />
              <table className="ledger w-full">
                <thead>
                  <tr>
                    <th className="text-left">Field</th>
                    {results.map((r, i) => (
                      <th key={i} className="text-left align-bottom">
                        <span className="block font-semibold">{r.source}</span>
                        <span className="block text-[10px] text-ink-faint font-normal">{r.model}</span>
                        <span className="block text-[10px] text-ink-faint font-normal">
                          {r.error ? <span className="text-error">error</span> : `${r.count} rec · ${(r.ms / 1000).toFixed(1)}s`}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map(([key, label]) => (
                    <tr key={key}>
                      <td className="font-gujarati text-xs whitespace-nowrap text-ink-soft">{label}</td>
                      {results.map((r, i) => {
                        const rec = r.records[recordIdx]
                        const f = rec?.[key]
                        return (
                          <td key={i} className="align-top">
                            {f?.value ? (
                              <span className="inline-flex items-start gap-1.5">
                                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot(f.confidence)}`} />
                                <span className="font-gujarati text-sm">{f.value}</span>
                              </span>
                            ) : (
                              <span className="text-ink-faint">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {results.some((r) => r.error) && (
                <div className="neu-card-flat p-3 space-y-1">
                  {results.filter((r) => r.error).map((r, i) => (
                    <p key={i} className="text-xs text-error">
                      <span className="font-semibold">{r.source} ({r.model}):</span> {r.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RecordStepper({
  results,
  recordIdx,
  setRecordIdx,
}: {
  results: EngineResult[]
  recordIdx: number
  setRecordIdx: (n: number) => void
}) {
  const maxRecords = Math.max(1, ...results.map((r) => r.records.length))
  if (maxRecords <= 1) return null
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-ink-soft">Student row:</span>
      <button
        onClick={() => setRecordIdx(Math.max(0, recordIdx - 1))}
        disabled={recordIdx === 0}
        className="neu-btn neu-btn-ghost min-h-[32px] px-3 disabled:opacity-30"
      >
        ←
      </button>
      <span className="text-mono">{recordIdx + 1} / {maxRecords}</span>
      <button
        onClick={() => setRecordIdx(Math.min(maxRecords - 1, recordIdx + 1))}
        disabled={recordIdx >= maxRecords - 1}
        className="neu-btn neu-btn-ghost min-h-[32px] px-3 disabled:opacity-30"
      >
        →
      </button>
    </div>
  )
}
