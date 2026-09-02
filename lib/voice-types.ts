import type { ParsedField, ParsedGRFields } from './ocr-parser'

export const VOICE_GROUP_IDS = [
  'identity',
  'birth-community',
  'admission',
  'leaving-notes',
] as const

export const VOICE_ENTRY_MODES = ['single', 'multi'] as const
export const VOICE_EXPECTED_COUNT_MIN = 1
export const VOICE_EXPECTED_COUNT_MAX = 10

export type VoiceGroupId = (typeof VOICE_GROUP_IDS)[number]
export type VoiceEntryMode = (typeof VOICE_ENTRY_MODES)[number]
export type VoiceLanguage = 'en-IN'
export type VoiceScript = 'en' | 'gu'
export type VoiceFieldSource =
  | 'ai'
  | 'canonical-lgd'
  | 'shared'
  | 'clerk'
  | 'single-script'

export interface VoiceFieldSources {
  en?: VoiceFieldSource
  gu?: VoiceFieldSource
}

/** Voice-only dual-script shape. OCR deliberately remains ParsedGRFields. */
export interface VoiceBilingualFields {
  en: ParsedGRFields
  gu: ParsedGRFields
  sources: Partial<Record<keyof ParsedGRFields, VoiceFieldSources>>
}

export type VoiceReviewFields = VoiceBilingualFields | ParsedGRFields

export interface VoiceEnglishFieldMetadata {
  value: string
  source: VoiceFieldSource
  confidence: ParsedField['confidence']
}

export type VoiceEnglishMetadata = Partial<
  Record<keyof ParsedGRFields, VoiceEnglishFieldMetadata>
>

export interface VoiceGroupDefinition {
  id: VoiceGroupId
  title: string
  shortTitle: string
  description: string
  example: string
  fields: readonly (keyof ParsedGRFields)[]
  skippable: boolean
}

interface VoiceProductionBase {
  language: VoiceLanguage
  transcript: string
  source: string
  model: string
  warning: string | null
  error: null
}

/** Successful production extraction for one dictated group of one student. */
export interface VoiceSingleEntryResponse extends VoiceProductionBase {
  mode: 'single'
  group: VoiceGroupId
  fields: VoiceBilingualFields
}

/** Backward-compatible name used by the existing four-group single-entry flow. */
export type VoiceEntryResponse = VoiceSingleEntryResponse

/** Successful production extraction for one free-form, multi-student recording. */
export interface VoiceMultiEntryResponse extends VoiceProductionBase {
  mode: 'multi'
  expectedCount: number | null
  students: VoiceBilingualFields[]
}

export type VoiceProductionResponse = VoiceSingleEntryResponse | VoiceMultiEntryResponse

export interface VoiceSingleCompareResult {
  entryMode: 'single'
  source: string
  model: string
  transcript: string
  fields: VoiceBilingualFields
  warning: string | null
  ms: number
  error: string | null
}

export interface VoiceMultiCompareResult {
  entryMode: 'multi'
  source: string
  model: string
  transcript: string
  students: VoiceBilingualFields[]
  warning: string | null
  ms: number
  error: string | null
}

export type VoiceCompareResult = VoiceSingleCompareResult | VoiceMultiCompareResult

export interface VoiceCompareResponse {
  mode: 'compare'
  entryMode: VoiceEntryMode
  group: VoiceGroupId | null
  expectedCount: number | null
  language: VoiceLanguage
  results: VoiceCompareResult[]
}

export interface VoiceHealthResponse {
  status: 'ok'
  configured: boolean
  language: VoiceLanguage
  extractorOrder: string[]
  models: string[]
  compareEnabled: boolean
  maxEntries: number
  message: string
}

export interface VoiceApiErrorResponse {
  error: string
}
