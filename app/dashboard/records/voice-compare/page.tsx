'use client'

/**
 * Voice model comparison is diagnostic only. One recording is sent to every
 * configured Gemini audio model through the authenticated debug route; no result
 * is applied to a GR form or saved.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import {
  GR_RECORD_FIELD_LABELS,
  GR_RECORD_FIELD_ORDER,
} from '@/lib/gr-record-data'
import {
  VOICE_FIELD_GROUPS,
  VOICE_FIELD_LABELS,
  VOICE_GROUP_ORDER,
} from '@/lib/voice-fields'
import {
  VOICE_EXPECTED_COUNT_MAX,
  VOICE_EXPECTED_COUNT_MIN,
  type VoiceApiErrorResponse,
  type VoiceCompareResponse,
  type VoiceEntryMode,
  type VoiceGroupId,
  type VoiceHealthResponse,
  type VoiceMultiCompareResult,
  type VoiceSingleCompareResult,
} from '@/lib/voice-types'

interface RecordedAudio {
  blob: Blob
  mimeType: string
  previewUrl: string
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
}

function extensionFor(mimeType: string): string {
  const base = mimeType.split(';', 1)[0].toLowerCase()
  if (base === 'audio/mp4') return 'm4a'
  if (base === 'audio/ogg') return 'ogg'
  return 'webm'
}

function confidenceClass(confidence?: 'high' | 'medium' | 'low') {
  if (confidence === 'high') return 'bg-success'
  if (confidence === 'medium') return 'bg-warning'
  if (confidence === 'low') return 'bg-error'
  return 'bg-transparent'
}

export default function VoiceComparePage() {
  const { session } = useAuth()
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const audioRef = useRef<RecordedAudio | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  const [entryMode, setEntryMode] = useState<VoiceEntryMode>('single')
  const [group, setGroup] = useState<VoiceGroupId>('identity')
  const [expectedCount, setExpectedCount] = useState<number | null>(null)
  const [maxEntries, setMaxEntries] = useState(VOICE_EXPECTED_COUNT_MAX)
  const [audio, setAudio] = useState<RecordedAudio | null>(null)
  const [starting, setStarting] = useState(false)
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [data, setData] = useState<VoiceCompareResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const busy = starting || recording || processing

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const replaceAudio = (next: RecordedAudio | null) => {
    if (audioRef.current) URL.revokeObjectURL(audioRef.current.previewUrl)
    audioRef.current = next
    setAudio(next)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
      controllerRef.current?.abort()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.onerror = null
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (audioRef.current) URL.revokeObjectURL(audioRef.current.previewUrl)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    async function loadVoiceHealth() {
      try {
        const response = await fetch('/api/voice-entry', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) return
        const health = await response.json() as VoiceHealthResponse
        if (!mountedRef.current || controller.signal.aborted) return
        const maximum = Number.isInteger(health.maxEntries)
          ? Math.max(
              VOICE_EXPECTED_COUNT_MIN,
              Math.min(VOICE_EXPECTED_COUNT_MAX, health.maxEntries)
            )
          : VOICE_EXPECTED_COUNT_MAX
        setMaxEntries(maximum)
        setExpectedCount((current) => current === null ? null : Math.min(current, maximum))
      } catch {
        // The health request is advisory; POST validation remains authoritative.
      }
    }
    void loadVoiceHealth()
    return () => controller.abort()
  }, [])

  function clearComparison() {
    setData(null)
    setError(null)
  }

  async function startRecording() {
    setError(null)
    setData(null)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(`Microphone recording needs HTTPS or localhost. Current origin: ${window.location.origin}.`)
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('This browser does not support MediaRecorder. Use a current Chrome, Edge, or Safari version.')
      return
    }

    controllerRef.current?.abort()
    requestIdRef.current += 1
    replaceAudio(null)
    setStarting(true)
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: { ideal: 1 }, echoCancellation: true, noiseSuppression: true },
        video: false,
      })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const selectedMimeType = preferredMimeType()
      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream)
      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        if (!mountedRef.current) return
        setError('Audio recording failed. Check the microphone and try again.')
        setRecording(false)
        stopTracks()
      }
      recorder.onstop = () => {
        stopTracks()
        recorderRef.current = null
        if (!mountedRef.current) return
        const mimeType = recorder.mimeType || selectedMimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        setRecording(false)
        if (!blob.size) {
          setError('No audio was captured. Check the microphone and try again.')
          return
        }
        if (blob.size > 10 * 1024 * 1024) {
          setError('This recording is larger than 10 MB. Record a shorter sample.')
          return
        }
        replaceAudio({ blob, mimeType, previewUrl: URL.createObjectURL(blob) })
      }
      recorder.start(250)
      setRecording(true)
    } catch (captureError) {
      stream?.getTracks().forEach((track) => track.stop())
      const name = captureError instanceof DOMException ? captureError.name : ''
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? `Microphone permission was blocked for ${window.location.host}. Allow it in browser settings and try again.`
          : name === 'NotReadableError'
            ? 'The microphone is in use by another app or tab. Close it and try again.'
            : captureError instanceof Error ? captureError.message : 'Could not start the microphone.'
      )
    } finally {
      if (mountedRef.current) setStarting(false)
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  async function compareModels() {
    if (!audio || processing) return
    if (!session?.access_token) {
      setError('Your session has expired. Sign in again before comparing models.')
      return
    }

    const submittedMode = entryMode
    const submittedGroup = group
    const submittedExpectedCount = expectedCount
    const requestId = ++requestIdRef.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setProcessing(true)
    setData(null)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('audio', audio.blob, `voice-compare.${extensionFor(audio.mimeType)}`)
      formData.append('mode', submittedMode)
      formData.append('language', 'en-IN')
      if (submittedMode === 'single') {
        formData.append('group', submittedGroup)
      } else if (submittedExpectedCount !== null) {
        formData.append('expectedCount', String(submittedExpectedCount))
      }

      const response = await fetch('/api/voice-entry?debug=all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
        signal: controller.signal,
      })
      const body = await response.json() as VoiceCompareResponse | VoiceApiErrorResponse
      if (!response.ok) {
        throw new Error(
          'error' in body && typeof body.error === 'string'
            ? body.error
            : `Request failed (${response.status})`
        )
      }
      if (!('mode' in body) || body.mode !== 'compare') {
        throw new Error('Voice compare mode is off. Set VOICE_DEBUG_COMPARE=1 and restart the server.')
      }
      if (body.entryMode !== submittedMode) {
        throw new Error('The server returned a different voice-entry mode. Run the comparison again.')
      }
      if (body.results.some((result) => result.entryMode !== submittedMode)) {
        throw new Error('At least one model returned the wrong comparison shape.')
      }
      if (!body.results.length) throw new Error('No configured voice models returned a comparison result.')
      if (!mountedRef.current || controller.signal.aborted || requestId !== requestIdRef.current) return
      setData(body)
    } catch (compareError) {
      if (controller.signal.aborted || !mountedRef.current || requestId !== requestIdRef.current) return
      setError(compareError instanceof Error ? compareError.message : String(compareError))
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      if (mountedRef.current && requestId === requestIdRef.current) setProcessing(false)
    }
  }

  const definition = VOICE_FIELD_GROUPS[group]
  const results = data?.results ?? []
  const singleResults = results.filter(
    (result): result is VoiceSingleCompareResult => result.entryMode === 'single'
  )
  const multiResults = results.filter(
    (result): result is VoiceMultiCompareResult => result.entryMode === 'multi'
  )

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/records" className="text-sm text-ink-soft hover:text-ink inline-flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to records
        </Link>
        <h1 className="text-3xl sm:text-4xl mt-3">Compare voice models</h1>
        <p className="text-sm text-ink-soft mt-2 max-w-2xl">
          Record one English sample and run that exact audio through every configured Gemini model.
          Compare grouped fields or multi-student segmentation, confidence, latency, and errors. Diagnostic only; nothing is saved.
        </p>
        <Link href="/dashboard/records/compare" className="text-xs font-semibold text-accent hover:underline mt-2 inline-block">
          Compare OCR engines instead →
        </Link>
      </div>

      <div className="neu-card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Voice comparison entry mode">
          <button
            type="button"
            onClick={() => {
              setEntryMode('single')
              clearComparison()
            }}
            disabled={busy}
            aria-pressed={entryMode === 'single'}
            className={`neu-btn text-xs ${entryMode === 'single' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
          >
            Single entry
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode('multi')
              clearComparison()
            }}
            disabled={busy}
            aria-pressed={entryMode === 'multi'}
            className={`neu-btn text-xs ${entryMode === 'multi' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
          >
            Multiple entries
          </button>
        </div>

        {entryMode === 'single' ? (
          <div>
            <label htmlFor="voice-compare-group" className="text-xs font-semibold text-ink-soft">Dictation group</label>
            <select
              id="voice-compare-group"
              value={group}
              onChange={(event) => {
                setGroup(event.target.value as VoiceGroupId)
                clearComparison()
              }}
              disabled={busy}
              className="neu-input mt-1.5"
            >
              {VOICE_GROUP_ORDER.map((groupId) => (
                <option key={groupId} value={groupId}>{VOICE_FIELD_GROUPS[groupId].title}</option>
              ))}
            </select>
            <p className="text-xs text-ink-soft mt-2">Example: “{definition.example}”</p>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-ink">Expected student count</p>
                <p className="text-[11px] text-ink-soft mt-0.5">Optional hint only; models are never padded or truncated.</p>
              </div>
              <div className="inline-flex items-center gap-1 self-start" role="group" aria-label="Expected student count">
                <button
                  type="button"
                  onClick={() => {
                    setExpectedCount(null)
                    clearComparison()
                  }}
                  disabled={busy}
                  aria-pressed={expectedCount === null}
                  className={`neu-btn px-3 py-2 text-xs ${expectedCount === null ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpectedCount((count) => count === null || count <= VOICE_EXPECTED_COUNT_MIN ? null : count - 1)
                    clearComparison()
                  }}
                  disabled={busy || expectedCount === null}
                  aria-label="Decrease expected student count"
                  className="neu-btn neu-btn-secondary px-3 py-2"
                >
                  −
                </button>
                <output className="min-w-10 text-center text-sm font-semibold text-mono text-ink" aria-live="polite">
                  {expectedCount ?? '—'}
                </output>
                <button
                  type="button"
                  onClick={() => {
                    setExpectedCount((count) => count === null ? VOICE_EXPECTED_COUNT_MIN : Math.min(maxEntries, count + 1))
                    clearComparison()
                  }}
                  disabled={busy || expectedCount === maxEntries}
                  aria-label="Increase expected student count"
                  className="neu-btn neu-btn-secondary px-3 py-2"
                >
                  +
                </button>
              </div>
            </div>
            <p className="text-xs text-ink-soft mt-3">
              Example: “Entry one: GR number 42, name Jagdish Dixit… Entry two: GR number 43, name…”
            </p>
            {expectedCount !== null && expectedCount > 6 && (
              <p className="text-xs text-warning mt-2">Segmentation accuracy can drop past about 6 entries.</p>
            )}
          </div>
        )}

        <p className="sr-only" aria-live="polite">
          {starting
            ? 'Requesting microphone.'
            : recording
              ? 'Recording comparison audio.'
              : processing
                ? 'Comparing all configured models.'
                : audio
                  ? 'Recording ready for playback and comparison.'
                  : 'Ready to record.'}
        </p>

        {recording ? (
          <button type="button" onClick={stopRecording} className="neu-btn neu-btn-danger w-full">
            Stop recording
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={starting || processing}
            className="neu-btn neu-btn-primary w-full"
          >
            {starting ? 'Requesting microphone…' : audio ? 'Record a new sample' : 'Start recording'}
          </button>
        )}

        {audio && !recording && (
          <div className="space-y-3">
            <audio controls src={audio.previewUrl} className="w-full" aria-label="Voice comparison recording playback" />
            <button
              type="button"
              onClick={compareModels}
              disabled={processing}
              className="neu-btn neu-btn-accent w-full"
            >
              {processing
                ? 'Running every configured model…'
                : entryMode === 'single'
                  ? 'Compare grouped extraction'
                  : 'Compare student segmentation'}
            </button>
          </div>
        )}

        <p className="text-[11px] text-ink-faint">
          Audio stays in memory only for this diagnostic and is never persisted.
        </p>
      </div>

      {error && (
        <div className="neu-card-flat p-4" style={{ borderColor: '#a8322b' }} role="alert">
          <p className="text-sm font-semibold text-error">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {results.map((result) => (
              <section key={`${result.source}-${result.model}`} className="neu-card overflow-hidden">
                <header className="px-4 py-3 border-b border-line-strong bg-surface-2">
                  <p className="text-sm font-semibold text-ink">{result.model}</p>
                  <p className="text-[11px] text-ink-faint mt-0.5">
                    {result.source} · {(result.ms / 1000).toFixed(2)}s · {'fields' in result
                      ? `${Object.keys(result.fields).length} fields`
                      : `${result.students.length} students`}
                  </p>
                </header>
                <div className="p-4 space-y-3">
                  {result.error && <p className="text-xs font-medium text-error">{result.error}</p>}
                  {result.warning && (
                    <p className="text-xs font-medium text-warning">{result.warning}</p>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Transcript</p>
                    <p className="text-sm text-ink mt-1.5 leading-relaxed">{result.transcript || '—'}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>

          {data?.entryMode === 'single' ? (
            <div className="overflow-x-auto">
              <table className="ledger w-full">
                <thead>
                  <tr>
                    <th className="text-left">Field</th>
                    {singleResults.map((result) => (
                      <th key={result.model} className="text-left">{result.model}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {definition.fields.map((field) => (
                    <tr key={field}>
                      <td className="text-xs text-ink-soft whitespace-nowrap">{VOICE_FIELD_LABELS[field]}</td>
                      {singleResults.map((result) => {
                        const english = result.fields.en[field]
                        const gujarati = result.fields.gu[field]
                        const value = gujarati ?? english
                        return (
                          <td key={result.model} className="align-top">
                            {value ? (
                              <span className="inline-flex items-start gap-1.5">
                                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${confidenceClass(value.confidence)}`} aria-hidden="true" />
                                <span className="text-sm text-ink">
                                  <span className="block font-gujarati">{gujarati?.value || '—'}</span>
                                  <span className="block text-xs text-ink-soft">{english?.value || '—'}</span>
                                </span>
                                <span className="sr-only">{value.confidence} confidence</span>
                              </span>
                            ) : <span className="text-ink-faint">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-6">
              {multiResults.map((result) => (
                <section key={`${result.source}-${result.model}-students`} className="neu-card overflow-hidden">
                  <header className="px-5 py-3 border-b border-line-strong bg-surface-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-ink">{result.model}</h2>
                      <span className="neu-badge bg-accent/10 text-accent">
                        {result.students.length} student{result.students.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </header>
                  <div className="p-4 sm:p-5 space-y-5">
                    {result.students.length === 0 ? (
                      <p className="text-sm text-ink-soft">No student records returned by this model.</p>
                    ) : result.students.map((student, studentIndex) => (
                      <article key={`${result.model}-student-${studentIndex}`} className="rounded-xl border border-line-strong overflow-hidden">
                        <header className="px-4 py-3 bg-surface-2 border-b border-line">
                          <p className="text-xs font-semibold text-accent text-mono">Student {studentIndex + 1}</p>
                          <p className="text-sm font-semibold text-ink mt-0.5">
                            <span className="font-gujarati">{student.gu.student_name?.value || '—'}</span>
                            <span className="text-ink-soft"> / {student.en.student_name?.value || '(Unknown name)'}</span>
                          </p>
                          <p className="text-xs text-ink-soft mt-0.5">
                            GR <span className="text-mono">{student.en.gr_number?.value || '—'}</span>
                          </p>
                        </header>
                        <div className="overflow-x-auto">
                          <table className="ledger w-full">
                            <thead>
                              <tr>
                                <th className="text-left">Field</th>
                                <th className="text-left">Extracted value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {GR_RECORD_FIELD_ORDER.map((field) => {
                                const english = student.en[field]
                                const gujarati = student.gu[field]
                                const value = gujarati ?? english
                                return (
                                  <tr key={field}>
                                    <td className="text-xs text-ink-soft whitespace-nowrap">{GR_RECORD_FIELD_LABELS[field]}</td>
                                    <td>
                                      {value ? (
                                        <span className="inline-flex items-start gap-1.5">
                                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${confidenceClass(value.confidence)}`} aria-hidden="true" />
                                          <span className="text-sm text-ink">
                                            <span className="block font-gujarati">{gujarati?.value || '—'}</span>
                                            <span className="block text-xs text-ink-soft">{english?.value || '—'}</span>
                                          </span>
                                          <span className="sr-only">{value.confidence} confidence</span>
                                        </span>
                                      ) : <span className="text-ink-faint">—</span>}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
