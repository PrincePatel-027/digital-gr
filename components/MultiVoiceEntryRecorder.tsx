'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  VOICE_EXPECTED_COUNT_MAX,
  VOICE_EXPECTED_COUNT_MIN,
  type VoiceApiErrorResponse,
  type VoiceHealthResponse,
  type VoiceLanguage,
  type VoiceMultiEntryResponse,
} from '@/lib/voice-types'

interface MultiVoiceEntryRecorderProps {
  disabled?: boolean
  language: VoiceLanguage
  onComplete?: (result: VoiceMultiEntryResponse) => void
  onClear?: () => void
  onProcessingChange?: (busy: boolean) => void
  onSessionStart?: () => void
  onReset?: () => void
}

interface AudioRecording {
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
const MAX_CLIENT_AUDIO_BYTES = 10 * 1024 * 1024
const LONG_RECORDING_SECONDS = 120
const SEGMENTATION_WARNING_COUNT = 6

function chooseRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
}

function extensionFor(mimeType: string): string {
  const base = mimeType.split(';', 1)[0].toLowerCase()
  if (base === 'audio/mp4') return 'm4a'
  if (base === 'audio/mpeg') return 'mp3'
  if (base === 'audio/wav') return 'wav'
  if (base === 'audio/ogg') return 'ogg'
  return 'webm'
}

function elapsedLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function describeMicrophoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `Microphone permission was blocked for ${window.location.host}. Allow microphone access in browser settings, then try again.`
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No usable microphone was found. Connect or enable a microphone, or enter the records manually.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The microphone is already in use by another app or browser tab. Close it, then try again.'
    case 'AbortError':
      return 'The microphone stopped responding while starting. Try again or enter the records manually.'
    default: {
      const detail = error instanceof Error ? `${error.name || 'Error'}: ${error.message}` : String(error)
      return `Could not start the microphone (${detail}). Check browser permission or enter the records manually.`
    }
  }
}

export default function MultiVoiceEntryRecorder({
  disabled = false,
  language,
  onComplete,
  onClear,
  onProcessingChange,
  onSessionStart,
  onReset,
}: MultiVoiceEntryRecorderProps) {
  const { session } = useAuth()
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingRef = useRef<AudioRecording | null>(null)
  const submitControllerRef = useRef<AbortController | null>(null)
  const requestGenerationRef = useRef(0)
  const mountedRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingCallbackRef = useRef(onProcessingChange)
  const sessionStartedRef = useRef(false)

  const [recording, setRecording] = useState<AudioRecording | null>(null)
  const [result, setResult] = useState<VoiceMultiEntryResponse | null>(null)
  const [expectedCount, setExpectedCount] = useState<number | null>(null)
  const [maxEntries, setMaxEntries] = useState(VOICE_EXPECTED_COUNT_MAX)
  const [providerUnavailable, setProviderUnavailable] = useState<string | null>(null)
  const [acquiring, setAcquiring] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const busy = acquiring || isRecording || finishing || processing
  const longRecording = elapsedSeconds > LONG_RECORDING_SECONDS
  const segmentationWarning = (
    expectedCount !== null && expectedCount > SEGMENTATION_WARNING_COUNT
  ) || (result?.students.length ?? 0) > SEGMENTATION_WARNING_COUNT

  useEffect(() => {
    processingCallbackRef.current = onProcessingChange
  }, [onProcessingChange])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const revokeRecording = useCallback(() => {
    if (recordingRef.current) URL.revokeObjectURL(recordingRef.current.previewUrl)
    recordingRef.current = null
    setRecording(null)
  }, [])

  useEffect(() => {
    onProcessingChange?.(busy)
  }, [busy, onProcessingChange])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestGenerationRef.current += 1
      submitControllerRef.current?.abort()
      const mediaRecorder = recorderRef.current
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.ondataavailable = null
        mediaRecorder.onstop = null
        mediaRecorder.onerror = null
        mediaRecorder.stop()
      }
      stopTimer()
      stopTracks()
      if (recordingRef.current) URL.revokeObjectURL(recordingRef.current.previewUrl)
      processingCallbackRef.current?.(false)
    }
  }, [stopTimer, stopTracks])

  useEffect(() => {
    const controller = new AbortController()
    async function loadHealth() {
      try {
        const response = await fetch('/api/voice-entry', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) return
        const health = await response.json() as VoiceHealthResponse
        if (!mountedRef.current || controller.signal.aborted) return
        if (Number.isInteger(health.maxEntries)) {
          const maximum = Math.max(
            VOICE_EXPECTED_COUNT_MIN,
            Math.min(VOICE_EXPECTED_COUNT_MAX, health.maxEntries)
          )
          setMaxEntries(maximum)
          setExpectedCount((current) => current === null ? null : Math.min(current, maximum))
        }
        setProviderUnavailable(health.configured ? null : health.message)
      } catch {
        // Health is advisory; POST still returns the authoritative error.
      }
    }
    void loadHealth()
    return () => controller.abort()
  }, [])

  const abortSubmission = useCallback(() => {
    requestGenerationRef.current += 1
    submitControllerRef.current?.abort()
    submitControllerRef.current = null
    setProcessing(false)
  }, [])

  const clearResult = useCallback(() => {
    setResult(null)
    onClear?.()
  }, [onClear])

  const startRecording = useCallback(async () => {
    if (disabled || busy || providerUnavailable) return
    setError(null)

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        `Voice recording needs HTTPS or localhost, but this page is ${window.location.origin}. ` +
        'Reopen the app over HTTPS, or enter the records manually.'
      )
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('This browser cannot record audio with MediaRecorder. Use a current Chrome, Edge, or Safari version, or enter the records manually.')
      return
    }

    setAcquiring(true)
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      if (!sessionStartedRef.current) {
        sessionStartedRef.current = true
        onSessionStart?.()
      }

      const preferredMimeType = chooseRecorderMimeType()
      const mediaRecorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)
      streamRef.current = stream
      recorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      mediaRecorder.onerror = (event) => {
        if (!mountedRef.current) return
        const recorderError = (event as Event & { error?: DOMException }).error
        setError(recorderError?.message || 'Audio recording failed. Try the batch again.')
        setIsRecording(false)
        setFinishing(false)
        stopTimer()
        stopTracks()
      }
      mediaRecorder.onstop = () => {
        stopTimer()
        stopTracks()
        recorderRef.current = null
        if (!mountedRef.current) return

        const mimeType = mediaRecorder.mimeType || preferredMimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        setIsRecording(false)
        setFinishing(false)
        if (!blob.size) {
          setError('No audio was captured. Check the microphone and record the batch again.')
          return
        }
        if (blob.size > MAX_CLIENT_AUDIO_BYTES) {
          setError('This recording is larger than 10 MB. Re-record a shorter batch; no audio was uploaded.')
          return
        }

        if (recordingRef.current) URL.revokeObjectURL(recordingRef.current.previewUrl)
        const nextRecording = {
          blob,
          mimeType,
          previewUrl: URL.createObjectURL(blob),
        }
        recordingRef.current = nextRecording
        setRecording(nextRecording)
      }

      setElapsedSeconds(0)
      mediaRecorder.start(250)
      setIsRecording(true)
      timerRef.current = setInterval(() => {
        if (mountedRef.current) setElapsedSeconds((seconds) => seconds + 1)
      }, 1000)
    } catch (captureError) {
      stream?.getTracks().forEach((track) => track.stop())
      if (streamRef.current === stream) streamRef.current = null
      if (mountedRef.current) setError(describeMicrophoneError(captureError))
    } finally {
      if (mountedRef.current) setAcquiring(false)
    }
  }, [busy, disabled, onSessionStart, providerUnavailable, stopTimer, stopTracks])

  const stopRecording = useCallback(() => {
    const mediaRecorder = recorderRef.current
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return
    setFinishing(true)
    mediaRecorder.stop()
  }, [])

  const rerecord = useCallback(() => {
    if (disabled || busy) return
    abortSubmission()
    revokeRecording()
    clearResult()
    setElapsedSeconds(0)
    setError(null)
  }, [abortSubmission, busy, clearResult, disabled, revokeRecording])

  const processRecording = useCallback(async () => {
    if (!recording || processing || disabled) return
    if (!session?.access_token) {
      setError('Your session has expired. Sign in again before processing this recording.')
      return
    }

    const requestId = ++requestGenerationRef.current
    submitControllerRef.current?.abort()
    const controller = new AbortController()
    submitControllerRef.current = controller
    setProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append(
        'audio',
        recording.blob,
        `multiple-entries.${extensionFor(recording.mimeType)}`
      )
      formData.append('mode', 'multi')
      formData.append('language', language)
      if (expectedCount !== null) formData.append('expectedCount', String(expectedCount))

      const response = await fetch('/api/voice-entry', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
        signal: controller.signal,
      })
      const body = await response.json() as VoiceMultiEntryResponse | VoiceApiErrorResponse
      if (!response.ok) {
        throw new Error(typeof body.error === 'string' && body.error ? body.error : 'Voice extraction failed.')
      }
      if (!mountedRef.current || controller.signal.aborted || requestId !== requestGenerationRef.current) return

      const extracted = body as VoiceMultiEntryResponse
      if (extracted.mode !== 'multi' || !Array.isArray(extracted.students)) {
        throw new Error('The server returned the wrong voice-entry mode. Record the batch again.')
      }
      if (extracted.students.length === 0) {
        throw new Error('No student entries were found. Use clear entry boundaries and record the batch again.')
      }
      if (extracted.students.length > maxEntries) {
        throw new Error(
          `The recording produced ${extracted.students.length} entries, above this school’s review limit of ${maxEntries}. ` +
          'No entries were removed; record a smaller batch.'
        )
      }

      setResult(extracted)
      onComplete?.(extracted)
    } catch (submitError) {
      if (controller.signal.aborted || !mountedRef.current || requestId !== requestGenerationRef.current) return
      setError(submitError instanceof Error ? submitError.message : 'Voice extraction failed. Try the batch again.')
    } finally {
      if (submitControllerRef.current === controller) submitControllerRef.current = null
      if (mountedRef.current && requestId === requestGenerationRef.current) setProcessing(false)
    }
  }, [disabled, expectedCount, language, maxEntries, onComplete, processing, recording, session])

  const resetAll = useCallback(() => {
    abortSubmission()
    stopTimer()
    const mediaRecorder = recorderRef.current
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.ondataavailable = null
      mediaRecorder.onstop = null
      mediaRecorder.onerror = null
      mediaRecorder.stop()
    }
    recorderRef.current = null
    stopTracks()
    revokeRecording()
    clearResult()
    setIsRecording(false)
    setFinishing(false)
    setElapsedSeconds(0)
    setError(null)
    sessionStartedRef.current = false
    onReset?.()
  }, [abortSubmission, clearResult, onReset, revokeRecording, stopTimer, stopTracks])

  const statusText = acquiring
    ? 'Requesting microphone permission.'
    : finishing
      ? 'Finishing the multiple-entry recording.'
      : isRecording
        ? `Recording multiple entries, ${elapsedLabel(elapsedSeconds)} elapsed.`
        : processing
          ? 'Transcribing and separating student entries.'
          : result
            ? `${result.students.length} student entries extracted and ready for review.`
            : recording
              ? 'Multiple-entry recording ready. Play it back, then extract the student rows.'
              : 'Ready to record several students in one continuous recording.'

  return (
    <div className="space-y-4">
      <div className="neu-card-flat p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-accent text-mono">One recording · several students</p>
            <h3 className="text-sm font-semibold text-ink mt-1">Multiple entries</h3>
            <p className="text-xs text-ink-soft mt-1">
              Say a clear boundary such as “Entry one” and “Entry two”. The count is only a hint and never adds or removes records.
            </p>
          </div>
          <span className="neu-badge bg-surface-2 text-ink-soft shrink-0">Max {maxEntries}</span>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-surface p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink">Expected entries</p>
              <p className="text-[11px] text-ink-soft mt-0.5">Optional check only · Auto detects the count from speech.</p>
            </div>
            <div className="inline-flex items-center gap-1 self-start" role="group" aria-label="Expected entry count">
              <button
                type="button"
                onClick={() => setExpectedCount(null)}
                disabled={busy || disabled || result !== null}
                aria-pressed={expectedCount === null}
                className={`neu-btn px-3 py-2 text-xs ${expectedCount === null ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setExpectedCount((count) => count === null || count <= VOICE_EXPECTED_COUNT_MIN ? null : count - 1)}
                disabled={busy || disabled || result !== null || expectedCount === null}
                aria-label="Decrease expected entry count"
                className="neu-btn neu-btn-secondary px-3 py-2"
              >
                −
              </button>
              <output className="min-w-10 text-center text-sm font-semibold text-mono text-ink" aria-live="polite">
                {expectedCount ?? '—'}
              </output>
              <button
                type="button"
                onClick={() => setExpectedCount((count) => count === null ? VOICE_EXPECTED_COUNT_MIN : Math.min(maxEntries, count + 1))}
                disabled={busy || disabled || result !== null || expectedCount === maxEntries}
                aria-label="Increase expected entry count"
                className="neu-btn neu-btn-secondary px-3 py-2"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 border-l-2 border-accent/40 pl-3">
          <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wide">Example script</p>
          <p className="text-xs text-ink-soft mt-1">
            “Entry one: GR number 42, name Jagdish Dixit, father Ramesh… Entry two: GR number 43, name…”
          </p>
        </div>
      </div>

      {segmentationWarning && (
        <div className="rounded-xl bg-warning/[0.08] border border-warning/25 px-4 py-3" role="note">
          <p className="text-xs font-semibold text-warning">Long batches need extra review</p>
          <p className="text-[11px] text-warning/80 mt-1">
            Segmentation accuracy can drop past about 6 entries. Prefer smaller recordings with explicit “Entry” boundaries.
          </p>
        </div>
      )}

      {providerUnavailable && (
        <div className="rounded-xl bg-warning/[0.08] border border-warning/25 px-4 py-3" role="alert">
          <p className="text-xs font-semibold text-warning">Voice processing is unavailable</p>
          <p className="text-[11px] text-warning/80 mt-1">{providerUnavailable}</p>
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">{statusText}</p>

      <div className="rounded-xl border border-line-strong bg-surface p-4">
        <p className="text-xs font-semibold text-ink">Recording status</p>
        <p className="text-xs text-ink-soft mt-1">{statusText}</p>

        {isRecording || finishing ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-error" role="status">
              <span className="relative flex h-3 w-3" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-50" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-error" />
              </span>
              <span className="text-sm font-semibold">
                {finishing ? 'Finishing…' : `Recording · ${elapsedLabel(elapsedSeconds)}`}
              </span>
            </div>
            {longRecording && (
              <div className="rounded-lg border border-warning/30 bg-warning/[0.07] p-3" role="alert">
                <p className="text-xs font-medium text-warning">
                  This recording is over 2 minutes. Longer audio can reduce segmentation accuracy and approach the 10 MB upload limit.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={stopRecording}
              disabled={finishing}
              className="neu-btn neu-btn-danger w-full"
            >
              {finishing ? 'Finishing recording…' : 'Stop recording'}
            </button>
          </div>
        ) : recording ? (
          <div className="mt-4 space-y-3">
            <audio controls src={recording.previewUrl} className="w-full" aria-label="Multiple-entry recording playback" />

            {result ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-success/[0.07] border border-success/25 p-3">
                  <p className="text-xs font-semibold text-success">
                    {result.students.length} student entr{result.students.length === 1 ? 'y' : 'ies'} extracted
                  </p>
                  <p className="text-sm text-ink mt-1.5 leading-relaxed">{result.transcript}</p>
                  <p className="text-[11px] text-ink-soft mt-2">
                    The editable batch review is ready below. Nothing has been saved.
                  </p>
                </div>
                {result.warning && (
                  <div className="rounded-lg border border-warning/30 bg-warning/[0.07] p-3" role="alert">
                    <p className="text-xs font-medium text-warning">{result.warning}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={resetAll}
                  disabled={disabled}
                  className="neu-btn neu-btn-ghost w-full"
                >
                  Discard this batch and start again
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={rerecord}
                  disabled={processing || disabled}
                  className="neu-btn neu-btn-secondary"
                >
                  Re-record
                </button>
                <button
                  type="button"
                  onClick={processRecording}
                  disabled={processing || disabled || Boolean(providerUnavailable)}
                  className="neu-btn neu-btn-primary"
                >
                  {processing ? 'Separating student entries…' : 'Extract student entries'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled || acquiring || processing || Boolean(providerUnavailable)}
            className="neu-btn neu-btn-primary w-full mt-4"
          >
            {acquiring ? 'Requesting microphone…' : 'Start multiple-entry recording'}
          </button>
        )}
      </div>

      {error && (
        <div className="neu-card-flat p-3 border-warning/50" role="alert">
          <p className="text-xs font-medium text-warning">{error}</p>
        </div>
      )}

      <div className="text-[11px] text-ink-faint leading-relaxed border-t border-line pt-3">
        Audio is sent only for extraction and is not persisted. Names stay in Latin script and all rows require human review.
      </div>
    </div>
  )
}
