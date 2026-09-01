import 'server-only'

import {
  DEFAULT_GEMINI_AUDIO_MODEL,
  extractVoice,
  extractVoiceFields,
  isGeminiAudioConfigured,
  type GeminiAudioResult,
  type GeminiMultiAudioResult,
} from './gemini-audio'
import type { ParsedGRFields } from './ocr-parser'
export { mergeVoiceGroups } from './voice-merge'
export type { MergedVoiceGroups, VoiceGroupMergeInput } from './voice-merge'
import {
  VOICE_EXPECTED_COUNT_MAX,
  VOICE_EXPECTED_COUNT_MIN,
  type VoiceCompareResponse,
  type VoiceEntryResponse,
  type VoiceGroupId,
  type VoiceHealthResponse,
  type VoiceLanguage,
  type VoiceMultiEntryResponse,
} from './voice-types'

const DEFAULT_EXTRACTOR_ORDER = ['gemini-audio']
const NAME_FIELDS: readonly (keyof ParsedGRFields)[] = [
  'student_name',
  'fathers_name',
  'mothers_name',
  'surname',
]

export interface VoiceRunner<TResult = GeminiAudioResult> {
  available: boolean
  run: () => Promise<TResult>
}

export type MultiVoiceRunner = VoiceRunner<GeminiMultiAudioResult>

interface PipelineOptionsBase {
  signal?: AbortSignal
  order?: readonly string[]
}

export interface VoicePipelineOptions extends PipelineOptionsBase {
  /** Test/future-provider seam; production runners remain server-owned. */
  runners?: Readonly<Record<string, VoiceRunner>>
}

export interface MultiVoicePipelineOptions extends PipelineOptionsBase {
  /** Test/future-provider seam; production runners remain server-owned. */
  runners?: Readonly<Record<string, MultiVoiceRunner>>
}

export type VoiceComparisonOptions =
  | {
      mode: 'single'
      group: VoiceGroupId
      language?: VoiceLanguage
      signal?: AbortSignal
    }
  | {
      mode: 'multi'
      expectedCount?: number | null
      language?: VoiceLanguage
      signal?: AbortSignal
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

function joinedWarnings(values: readonly (string | null | undefined)[]): string | null {
  const warnings = values.filter((value): value is string => Boolean(value?.trim()))
  return warnings.join(' | ') || null
}

export function getVoiceLanguage(): VoiceLanguage {
  // English is the only supported v1 language. Keep this behind configuration so
  // gu-IN can be added without changing the route or recorder contracts.
  return process.env.VOICE_LANGUAGE === 'en-IN' ? 'en-IN' : 'en-IN'
}

export function getVoiceMaxEntries(): number {
  const configured = Number(process.env.VOICE_MAX_ENTRIES)
  return Number.isInteger(configured) &&
    configured >= VOICE_EXPECTED_COUNT_MIN &&
    configured <= VOICE_EXPECTED_COUNT_MAX
    ? configured
    : VOICE_EXPECTED_COUNT_MAX
}

export function isVoiceCompareEnabled(): boolean {
  return enabledFlag(process.env.VOICE_DEBUG_COMPARE)
}

export function reconcileCount(
  expectedCount: number | null | undefined,
  actualCount: number
): string | null {
  if (expectedCount == null || expectedCount === actualCount) return null
  return `You expected ${expectedCount} ${expectedCount === 1 ? 'entry' : 'entries'}, I found ${actualCount}. Review before saving.`
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

function productionMultiRunners(
  audio: Buffer,
  mimeType: string,
  expectedCount: number | null,
  language: VoiceLanguage,
  signal?: AbortSignal
): Record<string, MultiVoiceRunner> {
  return {
    'gemini-audio': {
      available: isGeminiAudioConfigured(),
      run: () => extractVoice(audio, mimeType, {
        mode: 'multi',
        expectedCount,
        language,
        signal,
      }),
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
        mode: 'single',
        group,
        language,
        transcript: result.transcript.trim(),
        fields,
        source: key,
        model: result.model,
        warning: joinedWarnings(warnings),
        error: null,
      }
    }

    warnings.push(`${key}: ${result.error || (result.transcript.trim() ? 'no fields extracted' : 'empty transcript')}`)
  }

  const detail = warnings.join(' | ') || 'No voice extractor is available.'
  throw new VoicePipelineError(`Voice extraction failed: ${detail}`, warnings)
}

export async function runMultiVoicePipeline(
  audio: Buffer,
  mimeType: string,
  expectedCount: number | null = null,
  language: VoiceLanguage = getVoiceLanguage(),
  options: MultiVoicePipelineOptions = {}
): Promise<VoiceMultiEntryResponse> {
  const warnings: string[] = []
  const runners = options.runners ?? productionMultiRunners(
    audio,
    mimeType,
    expectedCount,
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

    let result: GeminiMultiAudioResult
    try {
      result = await candidate.run()
    } catch (error) {
      warnings.push(`${key}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    const students = result.students.map(pinNameConfidence)
    if (result.transcript.trim() && students.length > 0 && !result.error) {
      return {
        mode: 'multi',
        language,
        transcript: result.transcript.trim(),
        students,
        expectedCount,
        source: key,
        model: result.model,
        warning: joinedWarnings([
          ...warnings,
          reconcileCount(expectedCount, students.length),
        ]),
        error: null,
      }
    }

    warnings.push(`${key}: ${result.error || (result.transcript.trim() ? 'no student records extracted' : 'empty transcript')}`)
  }

  const detail = warnings.join(' | ') || 'No voice extractor is available.'
  throw new VoicePipelineError(`Multi-entry voice extraction failed: ${detail}`, warnings)
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
  options: VoiceComparisonOptions
): Promise<VoiceCompareResponse> {
  const language = options.language ?? getVoiceLanguage()
  const models = isGeminiAudioConfigured() ? comparisonModels() : []
  const results = await Promise.all(models.map(async (model) => {
    const startedAt = Date.now()
    try {
      if (options.mode === 'single') {
        const result = await extractVoice(audio, mimeType, {
          mode: 'single',
          group: options.group,
          model,
          language,
          signal: options.signal,
        })
        const fields = pinNameConfidence(result.fields)
        return {
          entryMode: 'single' as const,
          source: 'gemini-audio',
          model,
          transcript: result.transcript,
          fields,
          warning: null,
          ms: Date.now() - startedAt,
          error: result.error || (Object.keys(fields).length ? null : 'No fields extracted.'),
        }
      }

      const result = await extractVoice(audio, mimeType, {
        mode: 'multi',
        expectedCount: options.expectedCount,
        model,
        language,
        signal: options.signal,
      })
      const students = result.students.map(pinNameConfidence)
      return {
        entryMode: 'multi' as const,
        source: 'gemini-audio',
        model,
        transcript: result.transcript,
        students,
        warning: reconcileCount(options.expectedCount, students.length),
        ms: Date.now() - startedAt,
        error: result.error || (students.length ? null : 'No student records extracted.'),
      }
    } catch (error) {
      return options.mode === 'single'
        ? {
            entryMode: 'single' as const,
            source: 'gemini-audio',
            model,
            transcript: '',
            fields: {},
            warning: null,
            ms: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
          }
        : {
            entryMode: 'multi' as const,
            source: 'gemini-audio',
            model,
            transcript: '',
            students: [],
            warning: reconcileCount(options.expectedCount, 0),
            ms: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
          }
    }
  }))

  return {
    mode: 'compare',
    entryMode: options.mode,
    group: options.mode === 'single' ? options.group : null,
    expectedCount: options.mode === 'multi' ? options.expectedCount ?? null : null,
    language,
    results,
  }
}

export function getVoiceHealth(): VoiceHealthResponse {
  const configured = isGeminiAudioConfigured()
  const extractorOrder = csv(
    process.env.VOICE_EXTRACTOR_ORDER,
    DEFAULT_EXTRACTOR_ORDER.join(',')
  )
  const models = comparisonModels()
  const maxEntries = getVoiceMaxEntries()
  return {
    status: 'ok',
    configured,
    language: getVoiceLanguage(),
    extractorOrder,
    models,
    compareEnabled: isVoiceCompareEnabled(),
    maxEntries,
    message: configured
      ? `Voice extraction order: ${extractorOrder.join(' → ')}. Single and multi entry require human review; nothing auto-saves.`
      : 'Gemini voice extraction is unavailable until GEMINI_API_KEY is configured.',
  }
}
