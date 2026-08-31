import 'server-only'

import {
  DEFAULT_GEMINI_AUDIO_MODEL,
  extractVoiceFields,
  isGeminiAudioConfigured,
  type GeminiAudioResult,
} from './gemini-audio'
import type { ParsedGRFields } from './ocr-parser'
export { mergeVoiceGroups } from './voice-merge'
export type { MergedVoiceGroups, VoiceGroupMergeInput } from './voice-merge'
import type {
  VoiceCompareResponse,
  VoiceEntryResponse,
  VoiceGroupId,
  VoiceHealthResponse,
  VoiceLanguage,
} from './voice-types'

const DEFAULT_EXTRACTOR_ORDER = ['gemini-audio']
const NAME_FIELDS: readonly (keyof ParsedGRFields)[] = [
  'student_name',
  'fathers_name',
  'mothers_name',
  'surname',
]

export interface VoiceRunner {
  available: boolean
  run: () => Promise<GeminiAudioResult>
}

export interface VoicePipelineOptions {
  signal?: AbortSignal
  order?: readonly string[]
  /** Test/future-provider seam; production runners remain server-owned. */
  runners?: Readonly<Record<string, VoiceRunner>>
}

export class VoicePipelineError extends Error {
  constructor(
    message: string,
    readonly warnings: readonly string[] = []
  ) {
    super(message)
    this.name = 'VoicePipelineError'
  }
}

function enabledFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase())
}

function csv(value: string | undefined, fallback: string): string[] {
  return (value || fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export function getVoiceLanguage(): VoiceLanguage {
  // English is the only supported v1 language. Keep this behind configuration so
  // gu-IN can be added without changing the route or recorder contracts.
  return process.env.VOICE_LANGUAGE === 'en-IN' ? 'en-IN' : 'en-IN'
}

export function isVoiceCompareEnabled(): boolean {
  return enabledFlag(process.env.VOICE_DEBUG_COMPARE)
}

function pinNameConfidence(fields: ParsedGRFields): ParsedGRFields {
  const pinned: ParsedGRFields = { ...fields }
  for (const field of NAME_FIELDS) {
    if (pinned[field]) {
      pinned[field] = { value: pinned[field]!.value, confidence: 'medium' }
    }
  }
  return pinned
}

function productionRunners(
  audio: Buffer,
  mimeType: string,
  group: VoiceGroupId,
  language: VoiceLanguage,
  signal?: AbortSignal
): Record<string, VoiceRunner> {
  return {
    'gemini-audio': {
      available: isGeminiAudioConfigured(),
      run: () => extractVoiceFields(audio, mimeType, group, { language, signal }),
    },
  }
}

export async function runVoicePipeline(
  audio: Buffer,
  mimeType: string,
  group: VoiceGroupId,
  language: VoiceLanguage = getVoiceLanguage(),
  options: VoicePipelineOptions = {}
): Promise<VoiceEntryResponse> {
  const warnings: string[] = []
  const runners = options.runners ?? productionRunners(
    audio,
    mimeType,
    group,
    language,
    options.signal
  )
  const order = options.order ?? csv(
    process.env.VOICE_EXTRACTOR_ORDER,
    DEFAULT_EXTRACTOR_ORDER.join(',')
  )

  for (const key of order) {
    const candidate = runners[key]
    if (!candidate) {
      warnings.push(`${key}: extractor is not registered`)
      continue
    }
    if (!candidate.available) {
      warnings.push(`${key}: extractor is not configured`)
      continue
    }

    let result: GeminiAudioResult
    try {
      result = await candidate.run()
    } catch (error) {
      warnings.push(`${key}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    const fields = pinNameConfidence(result.fields)
    if (result.transcript.trim() && Object.keys(fields).length > 0 && !result.error) {
      return {
        group,
        language,
        transcript: result.transcript.trim(),
        fields,
        source: key,
        model: result.model,
        warning: warnings.join(' | ') || null,
        error: null,
      }
    }

    warnings.push(`${key}: ${result.error || (result.transcript.trim() ? 'no fields extracted' : 'empty transcript')}`)
  }

  const detail = warnings.join(' | ') || 'No voice extractor is available.'
  throw new VoicePipelineError(`Voice extraction failed: ${detail}`, warnings)
}

function comparisonModels(): string[] {
  const configured = process.env.GEMINI_AUDIO_MODEL || DEFAULT_GEMINI_AUDIO_MODEL
  return unique(csv(
    process.env.VOICE_COMPARE_GEMINI_MODELS,
    `${configured},gemini-2.5-flash`
  ))
}

export async function runVoiceComparison(
  audio: Buffer,
  mimeType: string,
  group: VoiceGroupId,
  language: VoiceLanguage = getVoiceLanguage(),
  signal?: AbortSignal
): Promise<VoiceCompareResponse> {
  const models = isGeminiAudioConfigured() ? comparisonModels() : []
  const results = await Promise.all(models.map(async (model) => {
    const startedAt = Date.now()
    try {
      const result = await extractVoiceFields(audio, mimeType, group, {
        model,
        language,
        signal,
      })
      const fields = pinNameConfidence(result.fields)
      return {
        source: 'gemini-audio',
        model,
        transcript: result.transcript,
        fields,
        ms: Date.now() - startedAt,
        error: result.error || (Object.keys(fields).length ? null : 'No fields extracted.'),
      }
    } catch (error) {
      return {
        source: 'gemini-audio',
        model,
        transcript: '',
        fields: {},
        ms: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }))

  return { mode: 'compare', group, language, results }
}

export function getVoiceHealth(): VoiceHealthResponse {
  const configured = isGeminiAudioConfigured()
  const extractorOrder = csv(
    process.env.VOICE_EXTRACTOR_ORDER,
    DEFAULT_EXTRACTOR_ORDER.join(',')
  )
  const models = comparisonModels()
  return {
    status: 'ok',
    configured,
    language: getVoiceLanguage(),
    extractorOrder,
    models,
    compareEnabled: isVoiceCompareEnabled(),
    message: configured
      ? `Voice extraction order: ${extractorOrder.join(' → ')}. First extractor returning a transcript and fields wins; nothing auto-saves.`
      : 'Gemini voice extraction is unavailable until GEMINI_API_KEY is configured.',
  }
}
