'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import {
  GUIDED_SCAN_LAYOUT,
  GUIDED_SCAN_TILE_COUNT,
  type GuidedScanResponse,
} from '@/lib/ocr-types'
import {
  MAX_GUIDED_SHOT_BYTES,
  MAX_GUIDED_TOTAL_BYTES,
  drawGuidedCropPreview,
  encodeGuidedCrop,
  formatGuidedBytes,
  isLikelyBlackVideoFrame,
  prepareGuidedFile,
  prepareGuidedVideo,
  rotateQuarterTurn,
  type GuidedCropSettings,
  type PreparedGuidedSource,
} from '@/lib/guided-capture-client'

interface GuidedRegisterScannerProps {
  disabled?: boolean
  onComplete: (result: GuidedScanResponse) => void
  onProcessingChange?: (processing: boolean) => void
}

interface LocalQuality {
  brightness: number
  contrast: number
  edgeDetail: number
  warnings: string[]
}

interface CaptureItem {
  sourceBlob: Blob
  blob: Blob
  previewUrl: string
  quality: LocalQuality | null
  crop: GuidedCropSettings
  initialRotation: GuidedCropSettings['rotation']
  dirty: boolean
}

interface CaptureStep {
  key: 'overview' | `tile${number}`
  title: string
  gujarati: string
  instruction: string
  position?: { row: number; column: number }
}

const CAPTURE_STEPS: CaptureStep[] = [
  {
    key: 'overview',
    title: 'Overview',
    gujarati: 'આખું રજિસ્ટર',
    instruction: 'Fit both pages in the frame. Keep the Gujarati text upright and the phone parallel to the paper.',
  },
  {
    key: 'tile0',
    title: 'Top left',
    gujarati: 'ઉપર ડાબે',
    instruction: 'Move closer to the top-left block. Include a little of the neighbouring block for overlap.',
    position: { row: 0, column: 0 },
  },
  {
    key: 'tile1',
    title: 'Top centre',
    gujarati: 'ઉપર મધ્યમાં',
    instruction: 'Capture the top-centre third, including the page join. Keep the same distance and include overlap.',
    position: { row: 0, column: 1 },
  },
  {
    key: 'tile2',
    title: 'Top right',
    gujarati: 'ઉપર જમણે',
    instruction: 'Capture the far-right third of the spread and overlap the top-centre block.',
    position: { row: 0, column: 2 },
  },
  {
    key: 'tile3',
    title: 'Bottom left',
    gujarati: 'નીચે ડાબે',
    instruction: 'Move down to the bottom-left block while keeping the same distance and orientation.',
    position: { row: 1, column: 0 },
  },
  {
    key: 'tile4',
    title: 'Bottom centre',
    gujarati: 'નીચે મધ્યમાં',
    instruction: 'Capture the bottom-centre block with overlap on all sides.',
    position: { row: 1, column: 1 },
  },
  {
    key: 'tile5',
    title: 'Bottom right',
    gujarati: 'નીચે જમણે',
    instruction: 'Capture the final bottom-right block. Keep page edges straight and avoid glare.',
    position: { row: 1, column: 2 },
  },
]

const EMPTY_CAPTURES: Array<CaptureItem | null> = Array.from(
  { length: GUIDED_SCAN_TILE_COUNT + 1 },
  () => null
)

function rounded(value: number): number {
  return Math.round(value * 10) / 10
}

function analyseCanvas(canvas: HTMLCanvasElement): LocalQuality {
  const sample = document.createElement('canvas')
  const sampleWidth = 240
  const sampleHeight = Math.max(120, Math.round(sampleWidth * canvas.height / canvas.width))
  sample.width = sampleWidth
  sample.height = sampleHeight

  const context = sample.getContext('2d', { willReadFrequently: true })
  if (!context) return { brightness: 0, contrast: 0, edgeDetail: 0, warnings: ['Could not analyse this frame'] }
  context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight)

  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data
  const luminance = new Float32Array(sampleWidth * sampleHeight)
  let sum = 0
  let sumSquared = 0

  for (let pixel = 0, index = 0; pixel < pixels.length; pixel += 4, index += 1) {
    const value = pixels[pixel] * 0.299 + pixels[pixel + 1] * 0.587 + pixels[pixel + 2] * 0.114
    luminance[index] = value
    sum += value
    sumSquared += value * value
  }

  const count = luminance.length
  const brightness = sum / count
  const contrast = Math.sqrt(Math.max(0, sumSquared / count - brightness * brightness))
  let edgeSum = 0
  let edgeCount = 0

  for (let y = 1; y < sampleHeight; y += 1) {
    for (let x = 1; x < sampleWidth; x += 1) {
      const index = y * sampleWidth + x
      edgeSum += Math.abs(luminance[index] - luminance[index - 1])
      edgeSum += Math.abs(luminance[index] - luminance[index - sampleWidth])
      edgeCount += 2
    }
  }

  const edgeDetail = edgeCount ? edgeSum / edgeCount : 0
  const warnings: string[] = []
  if (brightness < 45) warnings.push('Too dark — add light before continuing')
  if (brightness > 240) warnings.push('Too bright — reduce glare before continuing')
  if (contrast < 18) warnings.push('Low contrast — move closer or improve lighting')
  if (edgeDetail < 5) warnings.push('Low detail — hold still and wait for focus')

  return {
    brightness: rounded(brightness),
    contrast: rounded(contrast),
    edgeDetail: rounded(edgeDetail),
    warnings,
  }
}

async function buildCaptureItem(
  prepared: PreparedGuidedSource,
  preserveSourceAspect = false
): Promise<CaptureItem> {
  const crop: GuidedCropSettings = {
    rotation: prepared.initialRotation,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  }
  const encoded = await encodeGuidedCrop(prepared.blob, crop, preserveSourceAspect)
  return {
    sourceBlob: prepared.blob,
    blob: encoded.blob,
    previewUrl: URL.createObjectURL(encoded.blob),
    quality: analyseCanvas(encoded.canvas),
    crop,
    initialRotation: prepared.initialRotation,
    dirty: false,
  }
}

function revokeCapture(capture: CaptureItem | null): void {
  if (!capture) return
  URL.revokeObjectURL(capture.previewUrl)
}

export default function GuidedRegisterScanner({
  disabled = false,
  onComplete,
  onProcessingChange,
}: GuidedRegisterScannerProps) {
  const { session } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const cropPreviewRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const capturesRef = useRef<Array<CaptureItem | null>>(EMPTY_CAPTURES)
  const cameraRequestRef = useRef(0)
  const cropPreviewRequestRef = useRef(0)
  const recoveryTimerRef = useRef<number | null>(null)
  const cameraWantedRef = useRef(false)
  const resumeCameraAfterPickerRef = useRef(false)
  const restartCameraRef = useRef<() => Promise<void>>(async () => {})
  const trackCleanupRef = useRef<(() => void) | null>(null)
  const autoStartNextRef = useRef(false)
  const submitControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const [captures, setCaptures] = useState<Array<CaptureItem | null>>(() => [...EMPTY_CAPTURES])
  const [stepIndex, setStepIndex] = useState(0)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [reconstructedPreviewUrl, setReconstructedPreviewUrl] = useState<string | null>(null)

  const reviewMode = stepIndex >= CAPTURE_STEPS.length
  const currentStep = reviewMode ? null : CAPTURE_STEPS[stepIndex]
  const currentCapture = reviewMode ? null : captures[stepIndex]
  const preserveCurrentAspect = currentStep?.key === 'overview'
  const capturedCount = captures.filter(Boolean).length

  useEffect(() => {
    capturesRef.current = captures
  }, [captures])

  const releaseCamera = useCallback(() => {
    cameraRequestRef.current += 1
    if (recoveryTimerRef.current !== null) window.clearTimeout(recoveryTimerRef.current)
    recoveryTimerRef.current = null
    trackCleanupRef.current?.()
    trackCleanupRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
    setCameraStarting(false)
  }, [])

  const stopCamera = useCallback(() => {
    cameraWantedRef.current = false
    releaseCamera()
  }, [releaseCamera])

  const scheduleCameraRecovery = useCallback((message: string) => {
    if (!cameraWantedRef.current || document.visibilityState !== 'visible') return
    if (recoveryTimerRef.current !== null) window.clearTimeout(recoveryTimerRef.current)
    setCameraOpen(false)
    setCameraError(message)
    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = null
      if (mountedRef.current && cameraWantedRef.current) void restartCameraRef.current()
    }, 500)
  }, [])

  // The preview element is recreated between steps. Reattach and resume the current
  // stream even when the MediaStream object itself has not changed.
  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!cameraOpen || !video || !stream) return
    if (video.srcObject !== stream) video.srcObject = stream
    void video.play().catch(() => {
      scheduleCameraRecovery('The camera preview paused. Reconnecting…')
    })
  }, [cameraOpen, stepIndex, captures, scheduleCameraRecovery])

  useEffect(() => {
    const recoverWhenVisible = () => {
      if (document.visibilityState !== 'visible' || !cameraWantedRef.current) return
      const track = streamRef.current?.getVideoTracks()[0]
      if (!track || track.readyState !== 'live' || track.muted) {
        scheduleCameraRecovery('The camera was suspended. Reconnecting…')
        return
      }
      const video = videoRef.current
      if (video) {
        if (video.srcObject !== streamRef.current) video.srcObject = streamRef.current
        void video.play().catch(() => scheduleCameraRecovery('The camera preview paused. Reconnecting…'))
      }
    }
    document.addEventListener('visibilitychange', recoverWhenVisible)
    window.addEventListener('pageshow', recoverWhenVisible)
    return () => {
      document.removeEventListener('visibilitychange', recoverWhenVisible)
      window.removeEventListener('pageshow', recoverWhenVisible)
    }
  }, [scheduleCameraRecovery])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cameraWantedRef.current = false
      resumeCameraAfterPickerRef.current = false
      cameraRequestRef.current += 1
      cropPreviewRequestRef.current += 1
      if (recoveryTimerRef.current !== null) window.clearTimeout(recoveryTimerRef.current)
      trackCleanupRef.current?.()
      submitControllerRef.current?.abort()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      capturesRef.current.forEach(revokeCapture)
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCaptureError(null)

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      cameraWantedRef.current = false
      setCameraError('Live camera requires HTTPS or localhost. Use “Take/upload photo” below on this connection.')
      return
    }

    cameraWantedRef.current = true
    releaseCamera()
    cameraWantedRef.current = true
    const requestId = ++cameraRequestRef.current
    setCameraStarting(true)
    let acquired: MediaStream | null = null

    try {
      acquired = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
      })
      if (!mountedRef.current || requestId !== cameraRequestRef.current || !cameraWantedRef.current) {
        acquired.getTracks().forEach((track) => track.stop())
        return
      }

      const video = videoRef.current
      if (!video) throw new Error('Camera preview is unavailable.')
      const track = acquired.getVideoTracks()[0]
      if (!track) throw new Error('No video track was returned by this camera.')

      const recoverMuted = () => scheduleCameraRecovery('The camera feed was interrupted. Reconnecting…')
      const recoverEnded = () => scheduleCameraRecovery('The camera stopped. Reconnecting…')
      track.addEventListener('mute', recoverMuted)
      track.addEventListener('ended', recoverEnded)
      acquired.addEventListener('inactive', recoverEnded)
      trackCleanupRef.current = () => {
        track.removeEventListener('mute', recoverMuted)
        track.removeEventListener('ended', recoverEnded)
        acquired?.removeEventListener('inactive', recoverEnded)
      }

      streamRef.current = acquired
      video.srcObject = acquired
      await video.play()

      if (!mountedRef.current || requestId !== cameraRequestRef.current || !cameraWantedRef.current) {
        acquired.getTracks().forEach((currentTrack) => currentTrack.stop())
        if (streamRef.current === acquired) streamRef.current = null
        return
      }
      setCameraOpen(true)
      setCameraError(null)
    } catch (error) {
      acquired?.getTracks().forEach((track) => track.stop())
      if (streamRef.current === acquired) streamRef.current = null
      if (!mountedRef.current || requestId !== cameraRequestRef.current) return
      cameraWantedRef.current = false
      const name = error instanceof DOMException ? error.name : ''
      setCameraError(
        name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow access in browser settings or use photo upload.'
          : 'Could not start the rear camera. Use “Take/upload photo” instead.'
      )
    } finally {
      if (mountedRef.current && requestId === cameraRequestRef.current) setCameraStarting(false)
    }
  }, [releaseCamera, scheduleCameraRecovery])

  useEffect(() => {
    restartCameraRef.current = startCamera
  }, [startCamera])

  const restoreCameraAfterPicker = useCallback(() => {
    const shouldResume = resumeCameraAfterPickerRef.current
    resumeCameraAfterPickerRef.current = false
    if (shouldResume && mountedRef.current) void startCamera()
  }, [startCamera])

  useEffect(() => {
    const input = fileInputRef.current
    if (!input) return
    input.addEventListener('cancel', restoreCameraAfterPicker)
    return () => input.removeEventListener('cancel', restoreCameraAfterPicker)
  }, [currentCapture, restoreCameraAfterPicker, reviewMode, stepIndex])

  useEffect(() => {
    if (!autoStartNextRef.current || reviewMode || currentCapture) return
    autoStartNextRef.current = false
    void startCamera()
  }, [currentCapture, reviewMode, startCamera, stepIndex])

  const replaceCapture = useCallback((index: number, next: CaptureItem) => {
    if (!mountedRef.current) {
      revokeCapture(next)
      return
    }
    const previous = capturesRef.current[index]
    if (previous?.previewUrl !== next.previewUrl) {
      if (previous) URL.revokeObjectURL(previous.previewUrl)
    }
    const updated = [...capturesRef.current]
    updated[index] = next
    capturesRef.current = updated
    setCaptures(updated)
  }, [])

  const updateCurrentCrop = useCallback((patch: Partial<GuidedCropSettings>) => {
    const capture = capturesRef.current[stepIndex]
    if (!capture) return
    const updated = [...capturesRef.current]
    updated[stepIndex] = {
      ...capture,
      crop: { ...capture.crop, ...patch },
      dirty: true,
    }
    capturesRef.current = updated
    setCaptures(updated)
    setCaptureError(null)
  }, [stepIndex])

  const clearCapture = useCallback((index: number) => {
    const previous = capturesRef.current[index]
    revokeCapture(previous)
    const updated = [...capturesRef.current]
    updated[index] = null
    capturesRef.current = updated
    setCaptures(updated)
    autoStartNextRef.current = false
    setCaptureError(null)
  }, [])

  useEffect(() => {
    const capture = currentCapture
    const canvas = cropPreviewRef.current
    if (!capture || !canvas) return
    const requestId = ++cropPreviewRequestRef.current
    const timer = window.setTimeout(() => {
      void drawGuidedCropPreview(capture.sourceBlob, capture.crop, preserveCurrentAspect)
        .then((preview) => {
          if (!mountedRef.current || requestId !== cropPreviewRequestRef.current) return
          canvas.width = preview.width
          canvas.height = preview.height
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Canvas crop preview is unavailable in this browser.')
          context.drawImage(preview, 0, 0)
        })
        .catch((error) => {
          if (mountedRef.current && requestId === cropPreviewRequestRef.current) {
            setCaptureError(error instanceof Error ? error.message : 'Could not preview this crop.')
          }
        })
    }, 60)
    return () => {
      window.clearTimeout(timer)
      cropPreviewRequestRef.current += 1
    }
  }, [
    currentCapture,
    currentCapture?.crop.offsetX,
    currentCapture?.crop.offsetY,
    currentCapture?.crop.rotation,
    currentCapture?.crop.zoom,
    preserveCurrentAspect,
  ])

  async function applyCurrentCrop(): Promise<boolean> {
    const capture = capturesRef.current[stepIndex]
    if (!capture) return false
    if (!capture.dirty) return true

    setCapturing(true)
    setCaptureError(null)
    try {
      const encoded = await encodeGuidedCrop(
        capture.sourceBlob,
        capture.crop,
        CAPTURE_STEPS[stepIndex]?.key === 'overview'
      )
      if (!mountedRef.current) return false
      replaceCapture(stepIndex, {
        ...capture,
        blob: encoded.blob,
        previewUrl: URL.createObjectURL(encoded.blob),
        quality: analyseCanvas(encoded.canvas),
        dirty: false,
      })
      return true
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Could not apply this crop.')
      return false
    } finally {
      if (mountedRef.current) setCapturing(false)
    }
  }

  function rotateCurrentCapture(delta: -1 | 1) {
    const capture = capturesRef.current[stepIndex]
    if (!capture) return
    updateCurrentCrop({ rotation: rotateQuarterTurn(capture.crop.rotation, delta) })
  }

  function resetCurrentCrop() {
    const capture = capturesRef.current[stepIndex]
    if (!capture) return
    updateCurrentCrop({
      rotation: capture.initialRotation,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    })
  }

  async function captureFrame() {
    const video = videoRef.current
    const track = streamRef.current?.getVideoTracks()[0]
    if (!video || !track || track.readyState !== 'live' || track.muted || !currentStep) {
      scheduleCameraRecovery('The camera feed is not ready. Reconnecting…')
      return
    }
    if (isLikelyBlackVideoFrame(video)) {
      scheduleCameraRecovery('A blank camera frame was detected. Reconnecting…')
      return
    }

    setCapturing(true)
    setCaptureError(null)
    try {
      const prepared = await prepareGuidedVideo(video)
      stopCamera()
      const capture = await buildCaptureItem(prepared, currentStep.key === 'overview')
      replaceCapture(stepIndex, capture)
      autoStartNextRef.current = true
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Could not capture this frame.')
    } finally {
      if (mountedRef.current) setCapturing(false)
    }
  }

  function openFilePicker() {
    const input = fileInputRef.current
    if (!input) return
    autoStartNextRef.current = false
    resumeCameraAfterPickerRef.current = cameraWantedRef.current
    stopCamera()
    input.click()
  }

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      restoreCameraAfterPicker()
      return
    }
    if (!currentStep) {
      restoreCameraAfterPicker()
      return
    }

    setCapturing(true)
    setCaptureError(null)
    try {
      const prepared = await prepareGuidedFile(file)
      replaceCapture(stepIndex, await buildCaptureItem(prepared, currentStep.key === 'overview'))
      resumeCameraAfterPickerRef.current = false
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read this photo.'
      restoreCameraAfterPicker()
      setCaptureError(message)
    } finally {
      if (mountedRef.current) setCapturing(false)
    }
  }

  async function moveNext() {
    if (!capturesRef.current[stepIndex]) return
    if (!(await applyCurrentCrop())) return
    setCaptureError(null)
    if (stepIndex === CAPTURE_STEPS.length - 1) {
      autoStartNextRef.current = false
      stopCamera()
      setStepIndex(CAPTURE_STEPS.length)
      return
    }
    setStepIndex((current) => current + 1)
  }

  function editStep(index: number) {
    setCompleted(false)
    setReconstructedPreviewUrl(null)
    setCaptureError(null)
    setStepIndex(index)
  }

  function resetAll() {
    stopCamera()
    capturesRef.current.forEach(revokeCapture)
    const empty = [...EMPTY_CAPTURES]
    capturesRef.current = empty
    setCaptures(empty)
    setStepIndex(0)
    setCaptureError(null)
    setCameraError(null)
    setCompleted(false)
    setReconstructedPreviewUrl(null)
  }

  async function submitScan() {
    if (!session?.access_token) {
      setCaptureError('Your session has expired. Sign in again before processing the scan.')
      return
    }
    if (captures.some((capture) => !capture)) {
      setCaptureError('Capture the overview and all six blocks before processing.')
      return
    }

    const completedCaptures = capturesRef.current.filter((capture): capture is CaptureItem => Boolean(capture))
    if (completedCaptures.length !== CAPTURE_STEPS.length) {
      setCaptureError('Capture the overview and all six blocks before processing.')
      return
    }
    if (completedCaptures.some((capture) => capture.blob.size > MAX_GUIDED_SHOT_BYTES)) {
      setCaptureError('One or more shots exceed the safe upload size. Open each shot and apply its crop again.')
      return
    }
    const totalBytes = completedCaptures.reduce((sum, capture) => sum + capture.blob.size, 0)
    if (totalBytes > MAX_GUIDED_TOTAL_BYTES) {
      setCaptureError(`The seven-shot scan is ${formatGuidedBytes(totalBytes)}. Re-crop one or more shots before uploading.`)
      return
    }

    const controller = new AbortController()
    submitControllerRef.current = controller
    setProcessing(true)
    onProcessingChange?.(true)
    setCaptureError(null)
    try {
      const formData = new FormData()
      formData.append('layout', GUIDED_SCAN_LAYOUT)
      formData.append('overview', captures[0]!.blob, 'overview.jpg')
      for (let index = 0; index < GUIDED_SCAN_TILE_COUNT; index += 1) {
        formData.append(`tile${index}`, captures[index + 1]!.blob, `tile${index}.jpg`)
      }

      const response = await fetch('/api/ocr-scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
        signal: controller.signal,
      })
      // A failure raised before the route runs (413 at the edge) or after it is killed
      // (504) answers with a non-JSON body. Parsing that blindly reports a JSON syntax
      // error and hides the real cause, so fall back to the status.
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          typeof result?.error === 'string'
            ? result.error
            : response.status === 413
              ? 'The captured blocks are too large to upload. Retake them and try again.'
              : response.status === 504
                ? 'Processing timed out on the server. Try again with a clearer capture.'
                : `Guided scan processing failed (HTTP ${response.status}).`
        )
      }
      if (!result) throw new Error('Guided scan returned an unreadable response.')
      if (!mountedRef.current || controller.signal.aborted) return

      const guidedResult = result as GuidedScanResponse
      setCompleted(true)
      onComplete(guidedResult)

      const { data } = await supabase.storage
        .from('gr-images')
        .createSignedUrl(guidedResult.scan.storagePath, 60 * 10)
      if (mountedRef.current && !controller.signal.aborted && data?.signedUrl) {
        setReconstructedPreviewUrl(data.signedUrl)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (mountedRef.current) {
        setCaptureError(error instanceof Error ? error.message : 'Guided scan processing failed.')
      }
    } finally {
      if (submitControllerRef.current === controller) submitControllerRef.current = null
      if (mountedRef.current) {
        setProcessing(false)
        onProcessingChange?.(false)
      }
    }
  }

  function renderCoverageMap(activeIndex = stepIndex) {
    return (
      <div className="grid grid-cols-3 gap-1 w-28" aria-label="Six-block page coverage">
        {CAPTURE_STEPS.slice(1).map((step, tileIndex) => {
          const captureIndex = tileIndex + 1
          const isActive = activeIndex === captureIndex
          const isCaptured = Boolean(captures[captureIndex])
          return (
            <div
              key={step.key}
              className={`h-7 border flex items-center justify-center text-[10px] font-semibold transition-colors ${
                isActive
                  ? 'border-accent bg-accent text-white'
                  : isCaptured
                    ? 'border-success/50 bg-success/10 text-success'
                    : 'border-line-strong bg-paper/80 text-ink-faint'
              }`}
            >
              {tileIndex + 1}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink">Guided high-resolution scan</p>
          <p className="text-xs text-ink-soft mt-1">
            One overview + six overlapping close-ups. Hold the phone landscape; capture still photos, not moving video.
          </p>
        </div>
        <span className="neu-badge bg-accent/10 text-accent shrink-0">
          {capturedCount}/{CAPTURE_STEPS.length}
        </span>
      </div>

      <div
        className="h-1.5 bg-surface-2 overflow-hidden border border-line"
        role="progressbar"
        aria-label="Guided scan progress"
        aria-valuemin={0}
        aria-valuemax={CAPTURE_STEPS.length}
        aria-valuenow={capturedCount}
      >
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${capturedCount / CAPTURE_STEPS.length * 100}%` }}
        />
      </div>

      {!reviewMode && currentStep && (
        <div className="space-y-4">
          <div className="neu-card-flat p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-accent text-mono">
                Shot {stepIndex + 1} of {CAPTURE_STEPS.length}
              </p>
              <p className="font-gujarati-serif font-semibold mt-1">
                {currentStep.gujarati}
                <span className="text-ink-soft font-sans text-xs ml-2">{currentStep.title}</span>
              </p>
              <p className="text-xs text-ink-soft mt-1.5 max-w-lg">{currentStep.instruction}</p>
            </div>
            {currentStep.position ? renderCoverageMap() : (
              <div className="w-24 h-14 border-2 border-accent/60 bg-accent/[0.05] flex items-center justify-center text-[10px] text-accent font-semibold text-center px-2">
                Both pages
              </div>
            )}
          </div>

          {!captures[stepIndex] ? (
            <>
              <div className="relative aspect-[4/3] bg-[#171714] overflow-hidden border border-line-strong">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  aria-label="Live rear camera preview"
                  className={`block w-full h-full object-cover transition-opacity ${cameraOpen ? 'opacity-100' : 'opacity-0'}`}
                />
                {!cameraOpen && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 text-white/80">
                    <svg className="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <p className="text-sm font-semibold">Keep text upright and fill the guide</p>
                    <p className="text-xs text-white/55 mt-1">Hold still so the handwriting stays sharp.</p>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-[8%] border-2 border-white/80">
                  <span className="absolute -top-px -left-px w-8 h-8 border-t-4 border-l-4 border-accent" />
                  <span className="absolute -top-px -right-px w-8 h-8 border-t-4 border-r-4 border-accent" />
                  <span className="absolute -bottom-px -left-px w-8 h-8 border-b-4 border-l-4 border-accent" />
                  <span className="absolute -bottom-px -right-px w-8 h-8 border-b-4 border-r-4 border-accent" />
                  {currentStep.position && (
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/65 text-white text-[10px] font-semibold px-2 py-1 whitespace-nowrap">
                      OCR keeps this centre area
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {!cameraOpen ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={disabled || capturing || cameraStarting}
                    className="neu-btn neu-btn-primary"
                  >
                    {cameraStarting ? 'Starting camera…' : 'Start rear camera'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={captureFrame}
                    disabled={disabled || capturing}
                    className="neu-btn neu-btn-primary"
                  >
                    {capturing ? 'Capturing…' : 'Capture this block'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={disabled || capturing || cameraStarting}
                  className="neu-btn neu-btn-secondary"
                >
                  Take/upload photo
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleFileSelection}
                className="sr-only"
              />
            </>
          ) : currentCapture ? (
            <div className="space-y-4">
              <div className="relative aspect-[4/3] bg-[#171714] border border-line-strong overflow-hidden">
                <canvas
                  ref={cropPreviewRef}
                  className="block w-full h-full object-contain"
                  role="img"
                  aria-label={`${currentStep.title} crop preview`}
                />
                <div className="pointer-events-none absolute inset-[8%] border border-white/80">
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/65 text-white text-[10px] font-semibold px-2 py-1 whitespace-nowrap">
                    Keep handwriting inside this safe area
                  </span>
                </div>
                <span className={`absolute top-3 right-3 neu-badge ${
                  currentCapture.dirty
                    ? 'bg-warning text-white'
                    : currentCapture.quality?.warnings.length
                      ? 'bg-warning text-white'
                      : 'bg-success text-white'
                }`}>
                  {currentCapture.dirty
                    ? 'Crop not applied'
                    : currentCapture.quality?.warnings.length
                      ? 'Check quality'
                      : formatGuidedBytes(currentCapture.blob.size)}
                </span>
              </div>

              <div className="neu-card-flat p-4 space-y-4">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Rotate and reset crop">
                  <button
                    type="button"
                    onClick={() => rotateCurrentCapture(-1)}
                    disabled={processing || capturing}
                    className="neu-btn neu-btn-secondary flex-1"
                  >
                    Rotate left 90°
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateCurrentCapture(1)}
                    disabled={processing || capturing}
                    className="neu-btn neu-btn-secondary flex-1"
                  >
                    Rotate right 90°
                  </button>
                  <button
                    type="button"
                    onClick={resetCurrentCrop}
                    disabled={processing || capturing}
                    className="neu-btn neu-btn-ghost flex-1"
                  >
                    Reset crop
                  </button>
                </div>

                <label className="block text-xs font-semibold text-ink">
                  Crop zoom <span className="text-ink-soft font-normal">{currentCapture.crop.zoom.toFixed(2)}×</span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={currentCapture.crop.zoom}
                    onChange={(event) => updateCurrentCrop({ zoom: Number(event.target.value) })}
                    disabled={processing || capturing}
                    className="w-full mt-2 accent-[var(--color-accent)]"
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block text-xs font-semibold text-ink">
                    Move left or right
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.02"
                      value={currentCapture.crop.offsetX}
                      onChange={(event) => updateCurrentCrop({ offsetX: Number(event.target.value) })}
                      disabled={processing || capturing}
                      className="w-full mt-2 accent-[var(--color-accent)]"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-ink">
                    Move up or down
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.02"
                      value={currentCapture.crop.offsetY}
                      onChange={(event) => updateCurrentCrop({ offsetY: Number(event.target.value) })}
                      disabled={processing || capturing}
                      className="w-full mt-2 accent-[var(--color-accent)]"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-ink-faint">
                  Every accepted shot is converted to JPEG and kept below {formatGuidedBytes(MAX_GUIDED_SHOT_BYTES)} before upload.
                </p>
              </div>

              {currentCapture.quality?.warnings.map((warning) => (
                <p key={warning} className="text-xs text-warning font-medium">• {warning}</p>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => clearCapture(stepIndex)}
                  disabled={processing || capturing}
                  className="neu-btn neu-btn-ghost"
                >
                  Retake
                </button>
                <button
                  type="button"
                  onClick={moveNext}
                  disabled={processing || capturing}
                  className="neu-btn neu-btn-primary"
                >
                  {capturing
                    ? 'Applying crop…'
                    : stepIndex === CAPTURE_STEPS.length - 1
                      ? 'Apply crop and review'
                      : 'Apply crop and next'}
                </button>
              </div>
              <p className="sr-only" aria-live="polite">
                {currentCapture.dirty
                  ? 'Crop changes are ready to apply.'
                  : `Crop applied. ${formatGuidedBytes(currentCapture.blob.size)}.`}
              </p>
            </div>
          ) : null}

          {(cameraError || captureError) && (
            <div className="neu-card-flat p-3 border-warning/50" role="alert">
              <p className="text-xs font-medium text-warning">{captureError || cameraError}</p>
            </div>
          )}
        </div>
      )}

      {reviewMode && (
        <div className="space-y-4">
          <div className="neu-card-flat p-4">
            <p className="text-sm font-semibold text-ink">Review scan coverage</p>
            <p className="text-xs text-ink-soft mt-1">
              Retake any blurred, dark, or incorrectly positioned shot before OCR processing.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CAPTURE_STEPS.map((step, index) => {
              const capture = captures[index]
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => editStep(index)}
                  className="text-left border border-line-strong bg-surface hover:border-accent transition-colors overflow-hidden"
                >
                  {capture ? (
                    <img
                      src={capture.previewUrl}
                      alt=""
                      className={`w-full aspect-[4/3] ${index === 0 ? 'object-contain bg-[#171714]' : 'object-cover'}`}
                    />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-surface-2 flex items-center justify-center text-error text-xs">Missing</div>
                  )}
                  <span className="block px-2 py-2 text-[11px] font-semibold text-ink">
                    {index + 1}. {step.title}
                  </span>
                </button>
              )
            })}
          </div>

          {captureError && (
            <div className="neu-card-flat p-3 border-warning/50" role="alert">
              <p className="text-xs font-medium text-warning">{captureError}</p>
            </div>
          )}

          {completed ? (
            <div className="neu-card-flat p-4 border-success/40 bg-success/[0.06] space-y-3">
              <div>
                <p className="text-sm font-semibold text-success">Reconstructed scan processed</p>
                <p className="text-xs text-success/80 mt-1">Check the final page seams and extracted fields before saving.</p>
              </div>
              {reconstructedPreviewUrl && (
                <img
                  src={reconstructedPreviewUrl}
                  alt="Reconstructed guided register scan"
                  className="w-full max-h-72 object-contain border border-success/25 bg-surface"
                />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={submitScan}
              disabled={disabled || processing || captures.some((capture) => !capture)}
              className="neu-btn neu-btn-primary w-full"
            >
              {processing ? 'Reconstructing and reading the register…' : 'Build high-resolution scan and extract'}
            </button>
          )}

          <button
            type="button"
            onClick={resetAll}
            disabled={processing}
            className="neu-btn neu-btn-ghost w-full"
          >
            Start this scan again
          </button>
        </div>
      )}

      <div className="text-[11px] text-ink-faint leading-relaxed border-t border-line pt-3">
        Large phone photos are resized and compressed on-device before upload. Live camera requires HTTPS or localhost; if the phone suspends it, the scanner reconnects automatically.
      </div>
    </div>
  )
}
