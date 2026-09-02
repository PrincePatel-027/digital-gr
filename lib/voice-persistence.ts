import {
  prepareGRRecordBatch,
  savePreparedGRRecordBatch,
  type GRRecordBatchResult,
  type GRRecordBatchRow,
  type GRRecordBatchSource,
  type GRRecordPayloadWithMetadata,
  type SaveGRRecordBatchOptions,
} from './gr-record-batch'
import {
  buildGRRecordPayload,
  EMPTY_GR_RECORD,
  mergeParsedValues,
} from './gr-record-data'
import {
  coerceVoiceBilingualFields,
  voiceEnglishMetadata,
  voiceFieldsForScript,
} from './voice-bilingual'
import type { VoiceReviewFields } from './voice-types'

export interface VoiceGRRecordPayload extends GRRecordPayloadWithMetadata {
  fields_en: NonNullable<GRRecordPayloadWithMetadata['fields_en']>
}

/**
 * Voice-only persistence: reviewed Gujarati values populate the normal GR
 * columns, while English values and per-field provenance remain in fields_en.
 * Invariant IDs/dates and system audit fields are supplied only through their
 * normal columns by the hard-exclusion rules in voice-bilingual.ts.
 */
export function buildVoiceGRRecordPayload(
  fields: VoiceReviewFields,
  source: GRRecordBatchSource = {}
): VoiceGRRecordPayload {
  const dual = coerceVoiceBilingualFields(fields)
  const gujarati = voiceFieldsForScript(dual, 'gu')
  const record = mergeParsedValues({
    ...EMPTY_GR_RECORD,
    image_url: source.imageUrl ?? '',
    ocr_raw_text: source.ocrRawText ?? '',
  }, gujarati)

  return {
    ...buildGRRecordPayload(record),
    fields_en: voiceEnglishMetadata(dual),
  }
}

export function prepareVoiceGRRecordBatch(
  records: readonly VoiceReviewFields[],
  source: GRRecordBatchSource = {}
): GRRecordBatchRow[] {
  const gujaratiRows = records.map((record) => voiceFieldsForScript(record, 'gu'))
  return prepareGRRecordBatch(gujaratiRows, source).map((row) => ({
    ...row,
    payload: buildVoiceGRRecordPayload(records[row.index], source),
  }))
}

export async function saveVoiceGRRecordBatch(
  records: readonly VoiceReviewFields[],
  options: SaveGRRecordBatchOptions
): Promise<GRRecordBatchResult> {
  return savePreparedGRRecordBatch(prepareVoiceGRRecordBatch(records, options), options)
}
