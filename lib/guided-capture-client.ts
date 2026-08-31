export type QuarterTurn = 0 | 1 | 2 | 3

export interface GuidedCropSettings {
  rotation: QuarterTurn
  zoom: number
  offsetX: number
  offsetY: number
}

export interface PreparedGuidedSource {
  blob: Blob
  width: number
  height: number
  initialRotation: QuarterTurn
}

export interface EncodedGuidedCrop {
  blob: Blob
  canvas: HTMLCanvasElement
  width: number
  height: number
}

export const MAX_GUIDED_SHOT_BYTES = 560 * 1024
export const MAX_GUIDED_TOTAL_BYTES = 4 * 1024 * 1024 + 256 * 1024
export const MAX_GUIDED_SOURCE_BYTES = 30 * 1024 * 1024

const MAX_EDITING_EDGE = 2400
const MAX_EDITING_SOURCE_BYTES = 2 * 1024 * 1024
const OUTPUT_SIZES = [
  [1600, 1200],
  [1400, 1050],
  [1280, 960],
  [1024, 768],
] as const
const JPEG_QUALITIES = [0.86, 0.76, 0.66, 0.56] as const

interface LoadedImage {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not encode this photo.')),
      'image/jpeg',
      quality
    )
  })
}

async function loadBlob(blob: Blob): Promise<LoadedImage> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      }
    } catch {
      // Some mobile WebViews expose createImageBitmap but cannot decode camera files.
      // Fall through to an HTMLImageElement instead of returning the raw file.
    }
  }

  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  try {
    if (typeof image.decode === 'function') await image.decode()
    else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('This browser could not decode the photo.'))
      })
    }
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('This photo has no readable image data.')
    }
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

function downsampleSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number
): HTMLCanvasElement {
  const scale = Math.min(1, MAX_EDITING_EDGE / Math.max(sourceWidth, sourceHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas image preparation is unavailable in this browser.')
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function encodeEditingSource(canvas: HTMLCanvasElement): Promise<Blob> {
  let latest: Blob | null = null
  for (const quality of [0.9, 0.82, 0.74, 0.66]) {
    latest = await canvasToJpeg(canvas, quality)
    if (latest.size <= MAX_EDITING_SOURCE_BYTES) return latest
  }
  if (!latest) throw new Error('Could not prepare this photo for cropping.')
  return latest
}

async function prepareSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number
): Promise<PreparedGuidedSource> {
  if (!sourceWidth || !sourceHeight) throw new Error('This image has no readable dimensions.')
  const canvas = downsampleSource(source, sourceWidth, sourceHeight)
  return {
    blob: await encodeEditingSource(canvas),
    width: canvas.width,
    height: canvas.height,
    initialRotation: canvas.height > canvas.width ? 1 : 0,
  }
}

export async function prepareGuidedFile(file: File): Promise<PreparedGuidedSource> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.')
  }
  if (file.size > MAX_GUIDED_SOURCE_BYTES) {
    throw new Error('This source photo is larger than 30 MB. Lower the camera resolution and try again.')
  }

  const loaded = await loadBlob(file)
  try {
    return await prepareSource(loaded.source, loaded.width, loaded.height)
  } finally {
    loaded.close()
  }
}

export async function prepareGuidedVideo(video: HTMLVideoElement): Promise<PreparedGuidedSource> {
  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error('The camera is still starting. Wait a moment and try again.')
  }
  return prepareSource(video, video.videoWidth, video.videoHeight)
}

function orientedCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  rotation: QuarterTurn
): HTMLCanvasElement {
  const oddTurn = rotation % 2 === 1
  const canvas = document.createElement('canvas')
  canvas.width = oddTurn ? sourceHeight : sourceWidth
  canvas.height = oddTurn ? sourceWidth : sourceHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas rotation is unavailable in this browser.')

  if (rotation === 1) {
    context.translate(canvas.width, 0)
    context.rotate(Math.PI / 2)
  } else if (rotation === 2) {
    context.translate(canvas.width, canvas.height)
    context.rotate(Math.PI)
  } else if (rotation === 3) {
    context.translate(0, canvas.height)
    context.rotate(-Math.PI / 2)
  }
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight)
  return canvas
}

export function renderGuidedCrop(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  settings: GuidedCropSettings,
  targetWidth: number,
  targetHeight: number,
  preserveSourceAspect = false
): HTMLCanvasElement {
  const oriented = orientedCanvas(source, sourceWidth, sourceHeight, settings.rotation)
  const targetAspect = targetWidth / targetHeight
  const sourceAspect = oriented.width / oriented.height
  let baseWidth = oriented.width
  let baseHeight = oriented.height
  let outputWidth = targetWidth
  let outputHeight = targetHeight

  if (preserveSourceAspect) {
    const scale = Math.min(1, targetWidth / oriented.width, targetHeight / oriented.height)
    outputWidth = Math.max(1, Math.round(oriented.width * scale))
    outputHeight = Math.max(1, Math.round(oriented.height * scale))
  } else if (sourceAspect > targetAspect) {
    baseWidth = baseHeight * targetAspect
  } else {
    baseHeight = baseWidth / targetAspect
  }

  const zoom = Math.min(3, Math.max(1, settings.zoom))
  const cropWidth = baseWidth / zoom
  const cropHeight = baseHeight / zoom
  const offsetX = Math.min(1, Math.max(-1, settings.offsetX))
  const offsetY = Math.min(1, Math.max(-1, settings.offsetY))
  const cropX = (oriented.width - cropWidth) * (offsetX + 1) / 2
  const cropY = (oriented.height - cropHeight) * (offsetY + 1) / 2

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas cropping is unavailable in this browser.')
  context.drawImage(
    oriented,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight
  )
  return canvas
}

export async function encodeGuidedCrop(
  sourceBlob: Blob,
  settings: GuidedCropSettings,
  preserveSourceAspect = false
): Promise<EncodedGuidedCrop> {
  const loaded = await loadBlob(sourceBlob)
  try {
    const orientedWidth = settings.rotation % 2 === 1 ? loaded.height : loaded.width
    const orientedHeight = settings.rotation % 2 === 1 ? loaded.width : loaded.height
    const sourceLongEdge = Math.max(orientedWidth, orientedHeight)
    const sourceShortEdge = Math.min(orientedWidth, orientedHeight)
    if (preserveSourceAspect && (sourceLongEdge < 800 || sourceShortEdge < 600)) {
      throw new Error(
        `This overview is too small (${orientedWidth}×${orientedHeight}). Capture at least 800×600.`
      )
    }

    let latest: EncodedGuidedCrop | null = null
    const encodedSizes = new Set<string>()
    for (const [width, height] of OUTPUT_SIZES) {
      let targetWidth: number = width
      let targetHeight: number = height
      if (preserveSourceAspect) {
        const fitScale = Math.min(1, width / orientedWidth, height / orientedHeight)
        const minimumScale = Math.max(800 / sourceLongEdge, 600 / sourceShortEdge)
        const scale = Math.max(fitScale, minimumScale)
        targetWidth = Math.ceil(orientedWidth * scale)
        targetHeight = Math.ceil(orientedHeight * scale)
      }

      const canvas = renderGuidedCrop(
        loaded.source,
        loaded.width,
        loaded.height,
        settings,
        targetWidth,
        targetHeight,
        preserveSourceAspect
      )
      if (
        preserveSourceAspect &&
        (Math.max(canvas.width, canvas.height) < 800 || Math.min(canvas.width, canvas.height) < 600)
      ) {
        continue
      }
      const sizeKey = `${canvas.width}x${canvas.height}`
      if (encodedSizes.has(sizeKey)) continue
      encodedSizes.add(sizeKey)

      for (const quality of JPEG_QUALITIES) {
        const blob = await canvasToJpeg(canvas, quality)
        latest = { blob, canvas, width: canvas.width, height: canvas.height }
        if (blob.size <= MAX_GUIDED_SHOT_BYTES) return latest
      }
    }
    throw new Error(
      `This crop could not be reduced below ${formatGuidedBytes(MAX_GUIDED_SHOT_BYTES)}. ` +
      `Crop tighter or use a less noisy photo.${latest ? ` Last result: ${formatGuidedBytes(latest.blob.size)}.` : ''}`
    )
  } finally {
    loaded.close()
  }
}

export async function drawGuidedCropPreview(
  sourceBlob: Blob,
  settings: GuidedCropSettings,
  preserveSourceAspect = false
): Promise<HTMLCanvasElement> {
  const loaded = await loadBlob(sourceBlob)
  try {
    return renderGuidedCrop(
      loaded.source,
      loaded.width,
      loaded.height,
      settings,
      800,
      600,
      preserveSourceAspect
    )
  } finally {
    loaded.close()
  }
}

export function isLikelyBlackVideoFrame(video: HTMLVideoElement): boolean {
  if (!video.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return true
  }
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 24
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return false

  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let sum = 0
    let sumSquared = 0
    const count = pixels.length / 4
    for (let index = 0; index < pixels.length; index += 4) {
      const value = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114
      sum += value
      sumSquared += value * value
    }
    const mean = sum / count
    const variance = Math.max(0, sumSquared / count - mean * mean)
    return mean < 3 && variance < 2
  } catch {
    // Sampling is diagnostic only. The guarded capture path reports unreadable frames.
    return false
  }
}

export function formatGuidedBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${Math.ceil(bytes / 1024)} KB`
}

export function rotateQuarterTurn(current: QuarterTurn, delta: -1 | 1): QuarterTurn {
  return ((current + delta + 4) % 4) as QuarterTurn
}
