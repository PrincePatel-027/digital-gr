import 'server-only'

import { extractText, isOcrMockMode } from './ocr'
import { extractGRRecords, structureWithGemini, isGeminiConfigured } from './gemini-extract'
import { extractGRRecordsMistral, isMistralConfigured } from './mistral-extract'
import { extractGRRecordsOpenAI, isOpenAIConfigured } from './openai-extract'
import { structureWithSarvam, isSarvamConfigured } from './sarvam-structure'
import { extractGRRecordsSarvamDocAI, isSarvamDocAiConfigured } from './sarvam-doc-ai'
import type { ParsedGRFields } from './ocr-parser'
import type {
  OcrCompareResponse,
  OcrFileMeta,
  OcrHealthResponse,
  OcrMode,
  OcrPipelineResponse,
} from './ocr-types'

type ExtractResult = {
  records: ParsedGRFields[]
  raw: string
  mode: Exclude<OcrMode, 'real' | 'mock'>
  error?: string
}

// Gemini vision is the default first structured read. It can use the whole spread's
// geometry and shared column contract; Sarvam remains the Gujarati-specialised fallback.
// OCR_EXTRACTOR_ORDER can override this after fixture-based comparison.
const DEFAULT_ORDER = ['gemini', 'sarvam-doc-ai', 'gemini-text', 'openai', 'mistral', 'sarvam-text']

/**
 * Total wall-clock budget for one pipeline run (anchor + extraction chain).
 *
 * Every extractor swallows its own failure and returns zero records, so the chain
 * deliberately walks on to the next — and the later entries are the slowest
 * (reasoning models with a 16k token budget). Bounding each call is not enough:
 * six of them in sequence still outlives the function. Stopping on a deadline
 * returns the anchor text plus an explanatory warning, which is strictly more
 * useful than being killed mid-run and returning nothing at all.
 */
const DEFAULT_PIPELINE_BUDGET_MS = 200_000

/** Below this, an extractor has no realistic chance of finishing — don't start it. */
const MIN_EXTRACTOR_MS = 15_000

function pipelineBudgetMs(): number {
  const configured = Number(process.env.OCR_PIPELINE_BUDGET_MS)
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_PIPELINE_BUDGET_MS
}

function enabledFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase())
}

export function isOcrCompareEnabled(): boolean {
  return enabledFlag(process.env.OCR_DEBUG_COMPARE)
}

function csv(value: string | undefined, fallback: string): string[] {
  return (value || fallback).split(',').map((item) => item.trim()).filter(Boolean)
}

function labelFor(key: string, hasText: boolean): string {
  if (key === 'gemini') return hasText ? 'gemini+ocr' : 'gemini-vision'
  if (key === 'openai') return hasText ? 'openai+ocr' : 'openai-vision'
  if (key === 'mistral') return hasText ? 'mistral+ocr' : 'mistral-vision'
  return key
}

function sarvamDocAiRunner(buffer: Buffer, filename: string): () => Promise<ExtractResult> {
  return async () => {
    try {
      const records = await extractGRRecordsSarvamDocAI(buffer, filename)
      return { records, raw: '', mode: 'sarvam' }
    } catch (error) {
      return {
        records: [],
        raw: '',
        mode: 'sarvam',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

export async function runOcrPipeline(
  buffer: Buffer,
  fileMeta: OcrFileMeta
): Promise<OcrPipelineResponse> {
  const deadline = Date.now() + pipelineBudgetMs()
  const warnings: string[] = []
  const ocr = await extractText(buffer)
  const ocrText = ocr.text && ocr.text !== '(No text detected in image)' ? ocr.text : ''
  if (ocr.error) warnings.push(`ocr: ${ocr.error}`)

  const runSarvamDocAi = sarvamDocAiRunner(buffer, fileMeta.fileName)
  const runners: Record<
    string,
    { available: boolean; needsText: boolean; run: () => Promise<ExtractResult> }
  > = {
    'sarvam-doc-ai': {
      available: isSarvamDocAiConfigured(),
      needsText: false,
      run: runSarvamDocAi,
    },
    gemini: {
      available: isGeminiConfigured(),
      needsText: false,
      run: () => extractGRRecords(buffer, ocrText || undefined),
    },
    'gemini-text': {
      available: isGeminiConfigured(),
      needsText: true,
      run: () => structureWithGemini(ocrText),
    },
    openai: {
      available: isOpenAIConfigured(),
      needsText: false,
      run: () => extractGRRecordsOpenAI(buffer, ocrText || undefined),
    },
    mistral: {
      available: isMistralConfigured(),
      needsText: false,
      run: () => extractGRRecordsMistral(buffer, ocrText || undefined),
    },
    'sarvam-text': {
      available: isSarvamConfigured(),
      needsText: true,
      run: () => structureWithSarvam(ocrText),
    },
  }

  const order = csv(process.env.OCR_EXTRACTOR_ORDER, DEFAULT_ORDER.join(','))
  for (const key of order) {
    const candidate = runners[key]
    if (!candidate || !candidate.available || (candidate.needsText && !ocrText)) continue

    const remainingMs = deadline - Date.now()
    if (remainingMs < MIN_EXTRACTOR_MS) {
      warnings.push(`extraction stopped after ${pipelineBudgetMs()} ms budget: ${labelFor(key, Boolean(ocrText))} and any later extractor were skipped`)
      break
    }

    const result = await candidate.run()
    const label = labelFor(key, Boolean(ocrText))
    if (result.records.length > 0) {
      return {
        records: result.records,
        text: ocrText || result.raw,
        mode: result.mode,
        source: label,
        mock: false,
        error: null,
        warning: warnings.join(' | ') || null,
        ...fileMeta,
      }
    }
    warnings.push(`${label}: ${result.error || 'no records found'}`)
  }

  return {
    text: ocr.text,
    mode: ocr.mode,
    mock: ocr.mode === 'mock',
    error: ocrText
      ? null
      : (ocr.error || warnings.join(' | ') || 'Could not extract any text from the image.'),
    warning: warnings.join(' | ') || null,
    ...fileMeta,
  }
}

export async function runOcrComparison(
  buffer: Buffer,
  fileMeta: OcrFileMeta
): Promise<OcrCompareResponse> {
  const warnings: string[] = []
  const ocr = await extractText(buffer)
  if (ocr.error) warnings.push(`ocr: ${ocr.error}`)

  const runSarvamDocAi = sarvamDocAiRunner(buffer, fileMeta.fileName)
  const geminiModels = csv(
    process.env.OCR_COMPARE_GEMINI_MODELS,
    'gemini-2.5-pro,gemini-3.1-pro-preview'
  )
  const openaiModels = csv(
    process.env.OCR_COMPARE_OPENAI_MODELS,
    process.env.OPENAI_MODEL || 'gpt-5.6'
  )

  const tasks: Array<{
    source: string
    model: string
    run: () => Promise<ExtractResult>
  }> = []

  if (isSarvamDocAiConfigured()) {
    tasks.push({
      source: 'sarvam-doc-ai-extract',
      model: process.env.SARVAM_DOC_AI_MODEL || 'sarvam-vision-v1',
      run: runSarvamDocAi,
    })
  }
  if (isGeminiConfigured()) {
    for (const model of geminiModels) {
      tasks.push({
        source: 'gemini-vision',
        model,
        run: () => extractGRRecords(buffer, undefined, model),
      })
    }
  }
  if (isOpenAIConfigured()) {
    for (const model of openaiModels) {
      tasks.push({
        source: 'openai-vision',
        model,
        run: () => extractGRRecordsOpenAI(buffer, undefined, model),
      })
    }
  }
  if (isMistralConfigured()) {
    tasks.push({
      source: 'mistral-vision',
      model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
      run: () => extractGRRecordsMistral(buffer, undefined),
    })
  }

  const results = await Promise.all(
    tasks.map(async (task) => {
      const startedAt = Date.now()
      try {
        const result = await task.run()
        return {
          source: task.source,
          model: task.model,
          count: result.records.length,
          records: result.records,
          ms: Date.now() - startedAt,
          error: result.error ?? null,
        }
      } catch (error) {
        return {
          source: task.source,
          model: task.model,
          count: 0,
          records: [],
          ms: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })
  )

  return {
    mode: 'compare',
    anchorText: ocr.text,
    anchorError: ocr.error || null,
    results,
    warning: warnings.join(' | ') || null,
    ...fileMeta,
  }
}

export function getOcrHealth(): OcrHealthResponse {
  const sarvamDocAi = isSarvamDocAiConfigured()
  const gemini = isGeminiConfigured()
  const openai = isOpenAIConfigured()
  const mistral = isMistralConfigured()
  const sarvam = isSarvamConfigured()

  const anchor = sarvamDocAi
    ? 'sarvam doc-ai digitise (gu-IN) → ocr.space fallback'
    : 'ocr.space (transcribe page)'

  const labels: Record<string, string> = {
    'sarvam-doc-ai': `sarvam-doc-ai-extract (${process.env.SARVAM_DOC_AI_MODEL || 'sarvam-vision-v1'})`,
    gemini: `gemini+ocr (${process.env.GEMINI_MODEL || 'gemini-2.5-pro'})`,
    'gemini-text': 'gemini-text',
    openai: `openai (${process.env.OPENAI_MODEL || 'gpt-5.6'})`,
    mistral: `mistral+ocr (${process.env.MISTRAL_MODEL || 'mistral-small-latest'})`,
    'sarvam-text': `sarvam-text (${process.env.SARVAM_MODEL || 'sarvam-30b'})`,
  }
  const available: Record<string, boolean> = {
    'sarvam-doc-ai': sarvamDocAi,
    gemini,
    'gemini-text': gemini,
    openai,
    mistral,
    'sarvam-text': sarvam,
  }

  const order = csv(process.env.OCR_EXTRACTOR_ORDER, DEFAULT_ORDER.join(','))
  const strategies = order.filter((key) => available[key]).map((key) => labels[key])
  const anyStructurer = sarvamDocAi || gemini || openai || mistral || sarvam

  return {
    status: 'ok',
    mock: isOcrMockMode(),
    anchor,
    strategies: [anchor, ...strategies],
    preprocess: process.env.OCR_PREPROCESS ?? 'on',
    compareEnabled: isOcrCompareEnabled(),
    message: anyStructurer
      ? `Raw-text anchor: ${anchor}. Then structured by: ${strategies.join(' → ')} (first one that returns records wins).`
      : 'No AI provider configured — only raw OCR text will be returned. Add SARVAM_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY / MISTRAL_API_KEY.',
  }
}
