'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  VOICE_FIELD_GROUPS,
  VOICE_FIELD_LABELS,
  VOICE_GROUP_ORDER,
} from '@/lib/voice-fields'
import type {
  VoiceApiErrorResponse,
  VoiceEntryResponse,
  VoiceGroupId,
  VoiceLanguage,
} from '@/lib/voice-types'

interface VoiceEntryRecorderProps {
  disabled?: boolean
  language?: VoiceLanguage
  onGroupComplete: (result: VoiceEntryResponse) => void
  onGroupClear?: (group: VoiceGroupId) => void
  onProcessingChange?: (busy: boolean) => void
  onSessionStart?: () => void
  onReset?: () => void
}

interface GroupRecording {
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

function describeMicrophoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `Microphone permission was blocked for ${window.location.host}. Allow microphone access for this site in browser settings, then try again.`
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No usable microphone was found. Connect or enable a microphone, or enter this group manually.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The microphone is already in use by another app or browser tab. Close it, then try again.'
    case 'AbortError':
      return 'The microphone stopped responding while starting. Try again or enter this group manually.'
    default: {
      const detail = error instanceof Error ? `${error.name || 'Error'}: ${error.message}` : String(error)
      return `Could not start the microphone (${detail}). Check browser permission or enter this group manually.`
    }
  }
}

function elapsedLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export default function VoiceEntryRecorder({
  disabled = false,
  language = 'en-IN',
  onGroupComplete,
  onGroupClear,
  onProcessingChange,
  onSessionStart,
  onReset,
}: VoiceEntryRecorderProps) {
  const { session } = useAuth()
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingsRef = useRef<Partial<Record<VoiceGroupId, GroupRecording>>>({})
  const submitControllerRef = useRef<AbortController | null>(null)
  const requestGenerationRef = useRef(0)
  const mountedRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionStartedRef = useRef(false)

  const [stepIndex, setStepIndex] = useState(0)
  const [recordings, setRecordings] = useState<Partial<Record<VoiceGroupId, GroupRecording>>>({})
  const [results, setResults] = useState<Partial<Record<VoiceGroupId, VoiceEntryResponse>>>({})
  const [skipped, setSkipped] = useState<Set<VoiceGroupId>>(new Set())
  const [acquiring, setAcquiring] = useState(false)
  const [recording, setRecording] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const currentGroup = VOICE_GROUP_ORDER[stepIndex] ?? null
  const currentDefinition = currentGroup ? VOICE_FIELD_GROUPS[currentGroup] : null
  const currentRecording = currentGroup ? recordings[currentGroup] : undefined
  const currentResult = currentGroup ? results[currentGroup] : undefined
  const busy = acquiring || recording || finishing || processing

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const replaceRecording = useCallback((group: VoiceGroupId, next: GroupRecording) => {
    setRecordings((previous) => {
      if (previous[group]) URL.revokeObjectURL(previous[group]!.previewUrl)
      const updated = { ...previous, [group]: next }
      recordingsRef.current = updated
      return updated
    })
  }, [])

  const clearRecording = useCallback((group: VoiceGroupId) => {
    setRecordings((previous) => {
      if (previous[group]) URL.revokeObjectURL(previous[group]!.previewUrl)
      const updated = { ...previous }
      delete updated[group]
      recordingsRef.current = updated
      return updated
    })
  }, [])

  useEffect(() => {
    onProcessingChange?.(busy)
  }, [busy, onProcessingChange])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      requestGenerationRef.current += 1
      submitControllerRef.current?.abort()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.onerror = null
        recorder.stop()
      }
      stopTimer()
      stopTracks()
      Object.values(recordingsRef.current).forEach((item) => {
        if (item) URL.revokeObjectURL(item.previewUrl)
      })
      onProcessingChange?.(false)
    }
  }, [onProcessingChange, stopTimer, stopTracks])

  const startRecording = useCallback(async () => {
    if (!currentGroup || disabled || busy) return
    setError(null)

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(
        `Voice recording needs HTTPS or localhost, but this page is ${window.location.origin}. ` +
        'Reopen the app over HTTPS, or enter this group manually.'
      )
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('This browser cannot record audio with MediaRecorder. Use a current Chrome, Edge, or Safari version, or enter the fields manually.')
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
        setError(recorderError?.message || 'Audio recording failed. Try this group again.')
        setRecording(false)
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
        setRecording(false)
        setFinishing(false)
        if (!blob.size) {
          setError('No audio was captured. Check the microphone and record this group again.')
          return
        }
        if (blob.size > MAX_CLIENT_AUDIO_BYTES) {
          setError('This recording is larger than 10 MB. Re-record a shorter utterance for this group.')
          return
        }
        replaceRecording(currentGroup, {
          blob,
          mimeType,
          previewUrl: URL.createObjectURL(blob),
        })
      }

      setElapsedSeconds(0)
      mediaRecorder.start(250)
      setRecording(true)
      timerRef.current = setInterval(() => {
        if (mountedRef.current) setElapsedSeconds((value) => value + 1)
      }, 1000)
    } catch (captureError) {
      stream?.getTracks().forEach((track) => track.stop())
      if (streamRef.current === stream) streamRef.current = null
      if (mountedRef.current) setError(describeMicrophoneError(captureError))
    } finally {
      if (mountedRef.current) setAcquiring(false)
    }
  }, [busy, currentGroup, disabled, onSessionStart, replaceRecording, stopTimer, stopTracks])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    setFinishing(true)
    recorder.stop()
  }, [])

  const abortSubmission = useCallback(() => {
    requestGenerationRef.current += 1
    submitControllerRef.current?.abort()
    submitControllerRef.current = null
    setProcessing(false)
  }, [])

  const processRecording = useCallback(async () => {
    if (!currentGroup || !currentRecording || processing) return
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
        currentRecording.blob,
        `${currentGroup}.${extensionFor(currentRecording.mimeType)}`
      )
      formData.append('group', currentGroup)
      formData.append('language', language)

      const response = await fetch('/api/voice-entry', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
        signal: controller.signal,
      })
      const body = await response.json() as VoiceEntryResponse | VoiceApiErrorResponse
      if (!response.ok) {
        throw new Error(typeof body.error === 'string' && body.error ? body.error : 'Voice extraction failed.')
      }
      if (!mountedRef.current || controller.signal.aborted || requestId !== requestGenerationRef.current) return

      const result = body as VoiceEntryResponse
      if (result.group !== currentGroup) throw new Error('The server returned a different voice group. Record this group again.')
      setResults((previous) => ({ ...previous, [currentGroup]: result }))
      setSkipped((previous) => {
        const next = new Set(previous)
        next.delete(currentGroup)
        return next
      })
      onGroupComplete(result)
    } catch (submitError) {
      if (controller.signal.aborted || !mountedRef.current || requestId !== requestGenerationRef.current) return
      setError(submitError instanceof Error ? submitError.message : 'Voice extraction failed. Try this group again.')
    } finally {
      if (submitControllerRef.current === controller) submitControllerRef.current = null
      if (mountedRef.current && requestId === requestGenerationRef.current) setProcessing(false)
    }
  }, [currentGroup, currentRecording, language, onGroupComplete, processing, session])

  const rerecordGroup = useCallback(() => {
    if (!currentGroup) return
    abortSubmission()
    clearRecording(currentGroup)
    setResults((previous) => {
      const updated = { ...previous }
      delete updated[currentGroup]
      return updated
    })
    setSkipped((previous) => {
      const next = new Set(previous)
      next.delete(currentGroup)
      return next
    })
    onGroupClear?.(currentGroup)
    setElapsedSeconds(0)
    setError(null)
  }, [abortSubmission, clearRecording, currentGroup, onGroupClear])

  const skipCurrentGroup = useCallback(() => {
    if (!currentGroup || !currentDefinition?.skippable || busy) return
    rerecordGroup()
    setSkipped((previous) => new Set(previous).add(currentGroup))
    setStepIndex((index) => Math.min(index + 1, VOICE_GROUP_ORDER.length))
  }, [busy, currentDefinition?.skippable, currentGroup, rerecordGroup])

  const moveNext = useCallback(() => {
    if (busy) return
    setError(null)
    setStepIndex((index) => Math.min(index + 1, VOICE_GROUP_ORDER.length))
  }, [busy])

  const resetAll = useCallback(() => {
    abortSubmission()
    stopTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      recorder.stop()
    }
    recorderRef.current = null
    stopTracks()
    Object.values(recordingsRef.current).forEach((item) => {
      if (item) URL.revokeObjectURL(item.previewUrl)
    })
    recordingsRef.current = {}
    setRecordings({})
    setResults({})
    setSkipped(new Set())
    setStepIndex(0)
    setRecording(false)
    setFinishing(false)
    setElapsedSeconds(0)
    setError(null)
    sessionStartedRef.current = false
    onReset?.()
  }, [abortSubmission, onReset, stopTimer, stopTracks])

  const statusText = acquiring
    ? 'Requesting microphone permission.'
    : finishing
      ? 'Finishing the recording.'
      : recording
        ? `Recording ${currentDefinition?.title || 'voice group'}, ${elapsedLabel(elapsedSeconds)} elapsed.`
        : processing
          ? `Sending ${currentDefinition?.title || 'voice group'} to Gemini for transcription and field extraction.`
          : currentResult
            ? `${currentDefinition?.title || 'Voice group'} extracted. Review the transcript and fields.`
            : currentRecording
              ? `${currentDefinition?.title || 'Voice group'} recorded. Play it back, then extract fields or re-record.`
              : currentDefinition
                ? `Ready to record ${currentDefinition.title}.`
                : 'Voice entry groups complete. Review the form before saving.'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink">Grouped voice entry</p>
          <p className="text-xs text-ink-soft mt-1">
            Speak one section at a time in English. Audio is sent for extraction but is not saved; the transcript is kept for review.
          </p>
        </div>
        <span className="neu-badge bg-accent/10 text-accent shrink-0">en-IN</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="list" aria-label="Voice entry groups">
        {VOICE_GROUP_ORDER.map((group, index) => {
          const done = Boolean(results[group])
          const wasSkipped = skipped.has(group)
          const active = index === stepIndex
          return (
            <button
              key={group}
              type="button"
              role="listitem"
              onClick={() => {
                if (!busy) {
                  setError(null)
                  setStepIndex(index)
                }
              }}
              disabled={busy}
              aria-current={active ? 'step' : undefined}
              className={`min-h-14 px-3 py-2 text-left border transition-colors ${
                active
                  ? 'border-accent bg-accent/[0.07]'
                  : done
                    ? 'border-success/40 bg-success/[0.05]'
                    : 'border-line-strong bg-surface'
              }`}
            >
              <span className="block text-[10px] text-ink-faint text-mono">{index + 1} / 4</span>
              <span className="block text-xs font-semibold text-ink mt-0.5">{VOICE_FIELD_GROUPS[group].shortTitle}</span>
              <span className={`block text-[10px] mt-0.5 ${done ? 'text-success' : wasSkipped ? 'text-ink-faint' : 'text-ink-soft'}`}>
                {done ? 'Extracted' : wasSkipped ? 'Skipped' : active ? 'Current' : 'Not recorded'}
              </span>
            </button>
          )
        })}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{statusText}</p>

      {currentGroup && currentDefinition ? (
        <div className="space-y-4">
          <div className="neu-card-flat p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-accent text-mono">Group {stepIndex + 1} of 4</p>
                <h3 className="text-sm font-semibold text-ink mt-1">{currentDefinition.title}</h3>
                <p className="text-xs text-ink-soft mt-1">{currentDefinition.description}</p>
              </div>
              {currentDefinition.skippable && (
                <span className="neu-badge bg-surface-2 text-ink-soft">Optional</span>
              )}
            </div>
            <div className="mt-3 border-l-2 border-accent/40 pl-3">
              <p className="text-[10px] font-semibold text-ink-faint uppercase tracking-wide">Example</p>
              <p className="text-xs text-ink-soft mt-1">“{currentDefinition.example}”</p>
            </div>
            <p className="text-[11px] text-ink-faint mt-3">
              Fields: {currentDefinition.fields.map((field) => VOICE_FIELD_LABELS[field]).join(' · ')}
            </p>
          </div>

          <div className="rounded-xl border border-line-strong bg-surface p-4" aria-live="off">
            <p className="text-xs font-semibold text-ink">Recording status</p>
            <p className="text-xs text-ink-soft mt-1">{statusText}</p>

            {recording || finishing ? (
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
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={finishing}
                  className="neu-btn neu-btn-danger w-full"
                >
                  {finishing ? 'Finishing recording…' : 'Stop recording'}
                </button>
              </div>
            ) : currentRecording ? (
              <div className="mt-4 space-y-3">
                <audio
                  controls
                  src={currentRecording.previewUrl}
                  className="w-full"
                  aria-label={`Playback for ${currentDefinition.title}`}
                />

                {currentResult ? (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-success/[0.07] border border-success/25 p-3">
                      <p className="text-xs font-semibold text-success">Transcript heard by Gemini</p>
                      <p className="text-sm text-ink mt-1.5 leading-relaxed">{currentResult.transcript}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink-soft mb-2">Extracted fields · review in the form</p>
                      <div className="space-y-1.5">
                        {currentDefinition.fields.map((field) => {
                          const parsed = currentResult.fields[field]
                          if (!parsed) return null
                          return (
                            <div key={field} className="flex items-start gap-2 text-xs">
                              <span
                                className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${parsed.confidence === 'high' ? 'bg-success' : parsed.confidence === 'medium' ? 'bg-warning' : 'bg-error'}`}
                                aria-hidden="true"
                              />
                              <span className="min-w-28 text-ink-faint font-medium">{VOICE_FIELD_LABELS[field]}</span>
                              <span className="text-ink font-medium">{parsed.value}</span>
                              <span className="sr-only">{parsed.confidence} confidence</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {currentResult.warning && (
                      <p className="text-xs text-warning">Review note: {currentResult.warning}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button type="button" onClick={rerecordGroup} className="neu-btn neu-btn-secondary">
                        Re-record this group
                      </button>
                      <button type="button" onClick={moveNext} className="neu-btn neu-btn-primary">
                        {stepIndex === VOICE_GROUP_ORDER.length - 1 ? 'Finish voice entry' : 'Looks right · Next group'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={rerecordGroup}
                      disabled={processing}
                      className="neu-btn neu-btn-secondary"
                    >
                      Re-record
                    </button>
                    <button
                      type="button"
                      onClick={processRecording}
                      disabled={processing || disabled}
                      className="neu-btn neu-btn-primary"
                    >
                      {processing ? 'Transcribing and extracting…' : 'Use this recording'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={disabled || acquiring || processing}
                  className="neu-btn neu-btn-primary w-full"
                >
                  {acquiring ? 'Requesting microphone…' : `Start ${currentDefinition.shortTitle} recording`}
                </button>
                {currentDefinition.skippable && (
                  <button
                    type="button"
                    onClick={skipCurrentGroup}
                    disabled={disabled || busy}
                    className="neu-btn neu-btn-ghost w-full"
                  >
                    Skip leaving details for this admission
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="neu-card-flat p-3 border-warning/50" role="alert">
              <p className="text-xs font-medium text-warning">{error}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="neu-card-flat p-5 border-success/40 bg-success/[0.06] space-y-3">
          <div>
            <p className="text-sm font-semibold text-success">Voice entry groups complete</p>
            <p className="text-xs text-ink-soft mt-1">
              Review every auto-filled field and confidence dot in the form. Nothing has been saved yet.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VOICE_GROUP_ORDER.map((group, index) => (
              <button
                key={group}
                type="button"
                onClick={() => setStepIndex(index)}
                className="neu-btn neu-btn-secondary text-xs"
              >
                Review {VOICE_FIELD_GROUPS[group].shortTitle}
              </button>
            ))}
          </div>
          <button type="button" onClick={resetAll} className="neu-btn neu-btn-ghost w-full">
            Start voice entry again
          </button>
        </div>
      )}

      <div className="text-[11px] text-ink-faint leading-relaxed border-t border-line pt-3">
        Microphone recording requires HTTPS or localhost. Names stay in Latin script as spoken and are always marked for human review.
      </div>
    </div>
  )
}
