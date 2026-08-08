'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import {
  GUIDED_SCAN_LAYOUT,
  GUIDED_SCAN_TILE_COUNT,
  type GuidedScanResponse,
} from '@/lib/ocr-types'

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
  blob: Blob
  previewUrl: string
  quality: LocalQuality | null
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

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not encode the captured frame.')),
      'image/jpeg',
      0.92
    )
  })
}

function drawSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  overview: boolean
): HTMLCanvasElement {
  let drawable = source
  let width = sourceWidth
  let height = sourceHeight

  // This product scans an open landscape spread. Messaging apps frequently strip
  // EXIF, so normalize a portrait pixel matrix before the fixed 4:3 crop.
  if (height > width) {
    const oriented = document.createElement('canvas')
    oriented.width = height
    oriented.height = width
    const orientedContext = oriented.getContext('2d')
    if (!orientedContext) throw new Error('Canvas rotation is not available in this browser.')
    orientedContext.translate(oriented.width, 0)
    orientedContext.rotate(Math.PI / 2)
    orientedContext.drawImage(source, 0, 0, width, height)
    drawable = oriented
    width = oriented.width
    height = oriented.height
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas capture is not available in this browser.')

  if (overview) {
    const scale = Math.min(1, 1800 / width, 1400 / height)
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    context.drawImage(drawable, 0, 0, width, height, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  const targetWidth = 1600
  const targetHeight = 1200
  const targetAspect = targetWidth / targetHeight
  const sourceAspect = width / height
  let cropWidth = width
  let cropHeight = height
  let cropX = 0
  let cropY = 0

  if (sourceAspect > targetAspect) {
    cropWidth = height * targetAspect
    cropX = (width - cropWidth) / 2
  } else {
    cropHeight = width / targetAspect
    cropY = (height - cropHeight) / 2
  }

  canvas.width = targetWidth
  canvas.height = targetHeight
  context.drawImage(
    drawable,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    targetWidth,
    targetHeight
  )
  return canvas
}

async function normaliseUpload(file: File, overview: boolean): Promise<{
  blob: Blob
  quality: LocalQuality | null
}> {
  if (!('createImageBitmap' in window)) return { blob: file, quality: null }

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const canvas = drawSource(bitmap, bitmap.width, bitmap.height, overview)
    return { blob: await canvasToJpeg(canvas), quality: analyseCanvas(canvas) }
  } finally {
    bitmap.close()
  }
}

async function rotateBlob180(blob: Blob): Promise<{
  blob: Blob
  quality: LocalQuality | null
}> {
  if (!('createImageBitmap' in window)) return { blob, quality: null }

  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas rotation is not available in this browser.')
    context.translate(canvas.width, canvas.height)
    context.rotate(Math.PI)
    context.drawImage(bitmap, 0, 0)
    return { blob: await canvasToJpeg(canvas), quality: analyseCanvas(canvas) }
  } finally {
    bitmap.close()
  }
}

export default function GuidedRegisterScanner({
  disabled = false,
  onComplete,
  onProcessingChange,
}: GuidedRegisterScannerProps) {
  const { session } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const capturesRef = useRef<Array<CaptureItem | null>>(EMPTY_CAPTURES)
  const cameraRequestRef = useRef(0)
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
  const capturedCount = captures.filter(Boolean).length

  useEffect(() => {
    capturesRef.current = captures
  }, [captures])

  // The preview replaces the <video> element after each shot. Re-attach the same
  // live stream when the next empty step mounts its new video element.
  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!cameraOpen || !video || !stream || video.srcObject === stream) return
    video.srcObject = stream
    void video.play().catch(() => {
      if (mountedRef.current) setCameraError('Tap Start rear camera again to continue this scan.')
    })
  }, [cameraOpen, stepIndex, captures])

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
    setCameraStarting(false)
  }, [])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      cameraRequestRef.current += 1
      submitControllerRef.current?.abort()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      capturesRef.current.forEach((capture) => {
        if (capture) URL.revokeObjectURL(capture.previewUrl)
      })
    }
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setCaptureError(null)

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera requires HTTPS or localhost. Use “Take/upload photo” below on this connection.')
      return
    }

    stopCamera()
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
      if (!mountedRef.current || requestId !== cameraRequestRef.current) {
        acquired.getTracks().forEach((track) => track.stop())
        return
      }

      const video = videoRef.current
      if (!video) throw new Error('Camera preview is unavailable.')
      video.srcObject = acquired
      streamRef.current = acquired
      await video.play()

      if (!mountedRef.current || requestId !== cameraRequestRef.current) {
        acquired.getTracks().forEach((track) => track.stop())
        if (streamRef.current === acquired) streamRef.current = null
        return
      }
      setCameraOpen(true)
    } catch (error) {
      acquired?.getTracks().forEach((track) => track.stop())
      if (streamRef.current === acquired) streamRef.current = null
      if (!mountedRef.current || requestId !== cameraRequestRef.current) return
      const name = error instanceof DOMException ? error.name : ''
      setCameraError(
        name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow access in browser settings or use photo upload.'
          : 'Could not start the rear camera. Use “Take/upload photo” instead.'
      )
    } finally {
      if (mountedRef.current && requestId === cameraRequestRef.current) setCameraStarting(false)
    }
  }, [stopCamera])

  const replaceCapture = useCallback((index: number, next: CaptureItem) => {
    setCaptures((previous) => {
      const updated = [...previous]
      if (updated[index]) URL.revokeObjectURL(updated[index]!.previewUrl)
      updated[index] = next
      return updated
    })
  }, [])

  const clearCapture = useCallback((index: number) => {
    setCaptures((previous) => {
      const updated = [...previous]
      if (updated[index]) URL.revokeObjectURL(updated[index]!.previewUrl)
      updated[index] = null
      return updated
    })
    setCaptureError(null)
  }, [])

  async function rotateCurrentCapture() {
    const capture = captures[stepIndex]
    if (!capture) return

    setCapturing(true)
    setCaptureError(null)
    try {
      const rotated = await rotateBlob180(capture.blob)
      replaceCapture(stepIndex, {
        blob: rotated.blob,
        previewUrl: URL.createObjectURL(rotated.blob),
        quality: rotated.quality,
      })
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Could not rotate this photo.')
    } finally {
      setCapturing(false)
    }
  }

  async function captureFrame() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight || !currentStep) {
      setCaptureError('The camera is still focusing. Wait a moment and try again.')
      return
    }

    setCapturing(true)
    setCaptureError(null)
    try {
      const canvas = drawSource(
        video,
        video.videoWidth,
        video.videoHeight,
        currentStep.key === 'overview'
      )
      const quality = analyseCanvas(canvas)
      const blob = await canvasToJpeg(canvas)
      replaceCapture(stepIndex, {
        blob,
        previewUrl: URL.createObjectURL(blob),
        quality,
      })
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Could not capture this frame.')
    } finally {
      setCapturing(false)
    }
  }

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !currentStep) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setCaptureError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setCaptureError('This photo is larger than 8 MB. Choose a smaller original camera image.')
      return
    }

    setCapturing(true)
    setCaptureError(null)
    try {
      const normalised = await normaliseUpload(file, currentStep.key === 'overview')
      replaceCapture(stepIndex, {
        blob: normalised.blob,
        previewUrl: URL.createObjectURL(normalised.blob),
        quality: normalised.quality,
      })
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Could not read this photo.')
    } finally {
      setCapturing(false)
    }
  }

  function moveNext() {
    if (!captures[stepIndex]) return
    setCaptureError(null)
    if (stepIndex === CAPTURE_STEPS.length - 1) {
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
    capturesRef.current.forEach((capture) => {
      if (capture) URL.revokeObjectURL(capture.previewUrl)
    })
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
      const result = await response.json()
      if (!response.ok) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Guided scan processing failed.')
      }
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

      <div className="h-1.5 bg-surface-2 overflow-hidden border border-line">
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
                  className={`w-full h-full object-cover ${cameraOpen ? 'block' : 'hidden'}`}
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
                  onClick={() => fileInputRef.current?.click()}
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
          ) : (
            <div className="space-y-3">
              <div className="relative bg-surface-2 border border-line-strong overflow-hidden">
                <img
                  src={captures[stepIndex]!.previewUrl}
                  alt={`${currentStep.title} capture preview`}
                  className="w-full max-h-[420px] object-contain"
                />
                <span className={`absolute top-3 right-3 neu-badge ${
                  captures[stepIndex]!.quality?.warnings.length
                    ? 'bg-warning text-white'
                    : 'bg-success text-white'
                }`}>
                  {captures[stepIndex]!.quality?.warnings.length ? 'Check quality' : 'Captured'}
                </span>
              </div>

              {captures[stepIndex]!.quality?.warnings.map((warning) => (
                <p key={warning} className="text-xs text-warning font-medium">• {warning}</p>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                  onClick={rotateCurrentCapture}
                  disabled={processing || capturing}
                  className="neu-btn neu-btn-secondary"
                >
                  {capturing ? 'Rotating…' : 'Rotate 180°'}
                </button>
                <button
                  type="button"
                  onClick={moveNext}
                  disabled={processing || capturing}
                  className="neu-btn neu-btn-primary"
                >
                  {stepIndex === CAPTURE_STEPS.length - 1 ? 'Review all shots' : 'Looks good · Next'}
                </button>
              </div>
            </div>
          )}

          {(cameraError || captureError) && (
            <div className="neu-card-flat p-3 border-warning/50">
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
                    <img src={capture.previewUrl} alt="" className="w-full aspect-[4/3] object-cover" />
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
            <div className="neu-card-flat p-3 border-warning/50">
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
        Live camera works on HTTPS or localhost. On other phone connections, use the camera-file button for every shot.
      </div>
    </div>
  )
}
