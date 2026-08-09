/**
 * Image preprocessing for OCR / vision extraction.
 *
 * GR pages arrive as phone photos: uneven lighting, low local contrast, sometimes
 * small. Cleaning them up before sending to any reader (Sarvam / Gemini / OpenAI /
 * Mistral / OCR.space) measurably lifts handwriting accuracy — the top handwriting
 * OCR benchmarks preprocess mobile photos exactly this way (grayscale + contrast +
 * upscale) before recognition.
 *
 * Every provider funnels its image through preprocessForOcr() so the treatment is
 * applied once, in one place. Toggle with OCR_PREPROCESS=off to A/B test raw vs
 * cleaned input.
 */

import sharp from 'sharp'

// Longest edge we upscale small photos to, so fine Gujarati strokes survive OCR.
const TARGET_MIN_DIM = 2000

function isEnabled(): boolean {
  const v = (process.env.OCR_PREPROCESS ?? 'on').trim().toLowerCase()
  return v !== 'off' && v !== '0' && v !== 'false' && v !== 'no'
}

/**
 * Return a cleaned JPEG buffer ready to send to a reader.
 *
 * When preprocessing is disabled (or anything fails) it falls back to the previous
 * behaviour — auto-orient + JPEG — so this can never make a page worse than before.
 */
export async function preprocessForOcr(input: Buffer): Promise<Buffer> {
  // Baseline == the normalisation every provider used before this module existed.
  const baseline = () => sharp(input).rotate().jpeg({ quality: 92 }).toBuffer()

  if (!isEnabled()) {
    try {
      return await baseline()
    } catch {
      return input
    }
  }

  try {
    const oriented = sharp(input).rotate() // bake EXIF orientation first
    const meta = await oriented.metadata()
    const maxDim = Math.max(meta.width || 0, meta.height || 0)

    let pipeline = oriented
    // Upscale only small images (never downscale a good photo).
    if (maxDim && maxDim < TARGET_MIN_DIM) {
      pipeline = pipeline.resize({
        width: TARGET_MIN_DIM,
        height: TARGET_MIN_DIM,
        fit: 'inside',
        withoutEnlargement: false,
        kernel: 'lanczos3',
      })
    }

    // Grayscale + global contrast stretch + mild sharpen: lifts faint handwriting on
    // ruled paper without the halos/artefacts that aggressive thresholding causes.
    pipeline = pipeline.grayscale().normalize().sharpen()

    return await pipeline.jpeg({ quality: 92 }).toBuffer()
  } catch (err) {
    console.warn(`preprocessForOcr failed (${err instanceof Error ? err.message : String(err)}); using baseline normalisation.`)
    try {
      return await baseline()
    } catch {
      return input
    }
  }
}
