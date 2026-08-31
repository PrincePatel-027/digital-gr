import type { ParsedGRFields } from './ocr-parser'

/** The four independently recordable sections of one GR entry. */
export const VOICE_GROUP_IDS = [
  'identity',
  'birth-community',
  'admission',
  'leaving-notes',
] as const

export type VoiceGroupId = (typeof VOICE_GROUP_IDS)[number]
export type VoiceLanguage = 'en-IN'

export interface VoiceGroupDefinition {
  id: VoiceGroupId
  title: string
  shortTitle: string
  description: string
  example: string
  fields: readonly (keyof ParsedGRFields)[]
  skippable: boolean
}

/** Successful production extraction for one dictated group. */
export interface VoiceEntryResponse {
  group: VoiceGroupId
  language: VoiceLanguage
  transcript: string
  fields: ParsedGRFields
  source: string
  model: string
  warning: string | null
  error: null
}

export interface VoiceCompareResult {
  source: string
  model: string
  transcript: string
  fields: ParsedGRFields
  ms: number
  error: string | null
}

export interface VoiceCompareResponse {
  mode: 'compare'
  group: VoiceGroupId
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
  message: string
}

export interface VoiceApiErrorResponse {
  error: string
}
