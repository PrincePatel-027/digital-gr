import sharp from 'sharp'
import {
  GUIDED_SCAN_LAYOUT,
  GUIDED_SCAN_TILE_COUNT,
  type ScanImageQuality,
} from './ocr-types'

const MAX_INPUT_PIXELS = 12_000_000
const MIN_INPUT_WIDTH = 800
const MIN_INPUT_HEIGHT = 600
const NORMALISED_TILE_WIDTH = 1600
const NORMALISED_TILE_HEIGHT = 1200
// Quality is sampled at a fixed edge so the metrics stay comparable across phones.
const QUALITY_SAMPLE_EDGE = 1024
const CELL_WIDTH = 1400
const CELL_HEIGHT = 1000

export const RECONSTRUCTED_SCAN_WIDTH = CELL_WIDTH * 3
export const RECONSTRUCTED_SCAN_HEIGHT = CELL_HEIGHT * 2

export interface ReconstructedRegisterScan {
  buffer: Buffer
  width: number
  height: number
  layout: typeof GUIDED_SCAN_LAYOUT
  tiles: ScanImageQuality[]
}

function round(value: number, places = 2): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

async function qualityFor(
  oriented: Buffer,
  label: string,
  width: number,
  height: number
): Promise<ScanImageQuality> {
  // sharp's .stats() reads the INPUT image and ignores chained operations, so the
  // downscaled greyscale has to be materialized first. Measuring the chained pipeline
  // instead reports the RED channel of the full-size original, which reads brighter
  // and less sharp than luminance and made every real capture look blurred.
  const { data, info } = await sharp(oriented)
    .resize({ width: QUALITY_SAMPLE_EDGE, height: QUALITY_SAMPLE_EDGE, fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const stats = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  }).stats()

  const channel = stats.channels[0]
  const brightness = channel?.mean ?? 0
  const contrast = channel?.stdev ?? 0
  const entropy = stats.entropy ?? 0
  const sharpness = stats.sharpness ?? 0
  const warnings: string[] = []

  // Thresholds calibrated against real phone photos of these registers: in-focus pages
  // measure 1.6–5.0 sharpness, a 2px blur drops to ~0.55 and a 4px blur to ~0.2.
  if (brightness < 55) warnings.push('Image is very dark')
  if (brightness > 245) warnings.push('Image is overexposed')
  if (contrast < 18) warnings.push('Low contrast; handwriting may be faint')
  if (entropy < 2.5) warnings.push('Very little readable detail detected')
  if (sharpness > 0 && sharpness < 0.9) warnings.push('Image may be blurred')

  return {
    label,
    width,
    height,
    megapixels: round((width * height) / 1_000_000),
    brightness: round(brightness),
    contrast: round(contrast),
    entropy: round(entropy),
    sharpness: round(sharpness),
    acceptable: warnings.length === 0,
    warnings,
  }
}

async function orientAndInspect(input: Buffer, label: string): Promise<{
  oriented: Buffer
  quality: ScanImageQuality
}> {
  let converted: { data: Buffer; info: { width: number; height: number } }
  try {
    converted = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      .rotate()
      .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
      .toBuffer({ resolveWithObject: true })
  } catch (error) {
    throw new Error(`${label} is not a readable image: ${error instanceof Error ? error.message : String(error)}`)
  }

  let width = converted.info.width
  let height = converted.info.height

  // Camera apps and messaging tools often strip EXIF orientation. This register is
  // an open landscape spread, so a portrait pixel matrix is rotated before any crop.
  if (width < height) {
    converted = await sharp(converted.data)
      .rotate(90)
      .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
      .toBuffer({ resolveWithObject: true })
    width = converted.info.width
    height = converted.info.height
  }

  if (width < MIN_INPUT_WIDTH || height < MIN_INPUT_HEIGHT) {
    throw new Error(
      `${label} is too small (${width}×${height}). Capture at least ${MIN_INPUT_WIDTH}×${MIN_INPUT_HEIGHT}.`
    )
  }

  return {
    oriented: converted.data,
    quality: await qualityFor(converted.data, label, width, height),
  }
}

export async function assessRegisterImage(
  input: Buffer,
  label = 'overview'
): Promise<ScanImageQuality> {
  return (await orientAndInspect(input, label)).quality
}

async function normaliseTile(input: Buffer, index: number): Promise<{
  buffer: Buffer
  quality: ScanImageQuality
}> {
  const inspected = await orientAndInspect(input, `tile${index}`)
  const left = Math.floor((NORMALISED_TILE_WIDTH - CELL_WIDTH) / 2)
  const top = Math.floor((NORMALISED_TILE_HEIGHT - CELL_HEIGHT) / 2)

  const buffer = await sharp(inspected.oriented)
    .resize(NORMALISED_TILE_WIDTH, NORMALISED_TILE_HEIGHT, {
      fit: 'cover',
      position: 'centre',
      kernel: 'lanczos3',
    })
    .extract({ left, top, width: CELL_WIDTH, height: CELL_HEIGHT })
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer()

  return { buffer, quality: inspected.quality }
}

export async function reconstructRegisterScan(
  tileBuffers: Buffer[]
): Promise<ReconstructedRegisterScan> {
  if (tileBuffers.length !== GUIDED_SCAN_TILE_COUNT) {
    throw new Error(
      `Expected ${GUIDED_SCAN_TILE_COUNT} scan tiles, received ${tileBuffers.length}.`
    )
  }

  // Decode one camera frame at a time. Six simultaneous Sharp pipelines can consume
  // hundreds of MB even when the compressed multipart body is small.
  const normalised: Awaited<ReturnType<typeof normaliseTile>>[] = []
  for (let index = 0; index < tileBuffers.length; index += 1) {
    normalised.push(await normaliseTile(tileBuffers[index], index))
  }
  const composites = normalised.map((tile, index) => ({
    input: tile.buffer,
    left: (index % 3) * CELL_WIDTH,
    top: Math.floor(index / 3) * CELL_HEIGHT,
  }))

  const buffer = await sharp({
    create: {
      width: RECONSTRUCTED_SCAN_WIDTH,
      height: RECONSTRUCTED_SCAN_HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer()

  return {
    buffer,
    width: RECONSTRUCTED_SCAN_WIDTH,
    height: RECONSTRUCTED_SCAN_HEIGHT,
    layout: GUIDED_SCAN_LAYOUT,
    tiles: normalised.map((tile) => tile.quality),
  }
}
