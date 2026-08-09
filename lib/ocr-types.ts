import type { ParsedGRFields } from './ocr-parser'

export const GUIDED_SCAN_LAYOUT = '2x3-row-major-v1' as const
export const GUIDED_SCAN_TILE_COUNT = 6

export type OcrMode = 'real' | 'mock' | 'gemini' | 'mistral' | 'openai' | 'sarvam'

export interface OcrFileMeta {
  fileName: string
  fileSize: number
  fileType: string
}

interface OcrResponseBase extends OcrFileMeta {
  text: string
  mode: OcrMode
  mock: boolean
  error: string | null
  warning: string | null
}

export interface StructuredOcrResponse extends OcrResponseBase {
  records: ParsedGRFields[]
  source: string
}

export interface RawOcrResponse extends OcrResponseBase {
  records?: never
  source?: never
}

export type OcrPipelineResponse = StructuredOcrResponse | RawOcrResponse

export interface OcrCompareResult {
  source: string
  model: string
  count: number
  records: ParsedGRFields[]
  ms: number
  error: string | null
}

export interface OcrCompareResponse extends OcrFileMeta {
  mode: 'compare'
  anchorText: string
  anchorError: string | null
  results: OcrCompareResult[]
  warning: string | null
}

export interface OcrHealthResponse {
  status: 'ok'
  mock: boolean
  anchor: string
  strategies: string[]
  preprocess: string
  compareEnabled: boolean
  message: string
}

export interface ScanImageQuality {
  label: string
  width: number
  height: number
  megapixels: number
  brightness: number
  contrast: number
  entropy: number
  sharpness: number
  acceptable: boolean
  warnings: string[]
}

export interface GuidedScanMetadata {
  storagePath: string
  layout: typeof GUIDED_SCAN_LAYOUT
  width: number
  height: number
  overview: ScanImageQuality
  tiles: ScanImageQuality[]
  warnings: string[]
}

export type GuidedScanResponse = OcrPipelineResponse & {
  scan: GuidedScanMetadata
}

export interface ApiErrorResponse {
  error: string
}
