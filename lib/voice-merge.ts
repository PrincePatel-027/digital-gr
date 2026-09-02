import { STRING_FIELDS, toParsedRecord } from './extract-shared'
import type { ParsedField, ParsedGRFields } from './ocr-parser'
import { createVoiceBilingualFields } from './voice-bilingual'
import { VOICE_FIELD_GROUPS, VOICE_GROUP_ORDER } from './voice-fields'
import type {
  VoiceBilingualFields,
  VoiceEntryResponse,
  VoiceGroupId,
  VoiceScript,
} from './voice-types'

const NAME_FIELDS: readonly (keyof ParsedGRFields)[] = [
  'student_name',
  'fathers_name',
  'mothers_name',
  'surname',
]
const CONFIDENCE_RANK: Record<ParsedField['confidence'], number> = {
  low: 0,
  medium: 1,
  high: 2,
}

export interface VoiceGroupMergeInput {
  group: VoiceGroupId
  fields: VoiceBilingualFields
  warning?: string | null
}

export interface MergedVoiceGroups {
  fields: VoiceBilingualFields
  warning: string | null
}

function lowerConfidence(
  a: ParsedField['confidence'],
  b: ParsedField['confidence']
): ParsedField['confidence'] {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b
}

function sanitizeMergedScript(
  merged: VoiceBilingualFields,
  script: VoiceScript
): ParsedGRFields {
  const raw = Object.fromEntries(
    STRING_FIELDS.flatMap((field) => {
      const parsed = merged[script][field]
      return parsed ? [[field, parsed.value]] : []
    })
  )
  const sanitized = toParsedRecord(raw, 'high', {
    allowedFields: STRING_FIELDS,
    requireIdentity: false,
    downgradeAdmissionLeavingAmbiguity: true,
  }) ?? {}

  for (const field of STRING_FIELDS) {
    const finalField = sanitized[field]
    const original = merged[script][field]
    if (!finalField || !original) continue
    finalField.confidence = NAME_FIELDS.includes(field)
      ? 'medium'
      : lowerConfidence(finalField.confidence, original.confidence)
  }
  return sanitized
}

/**
 * Merge the latest result for each dictated group. Later inputs win on the same
 * field (used when a group is re-recorded), then shared sanitation runs once on
 * each script and canonical locations are resolved locally.
 */
export function mergeVoiceGroups(groups: readonly VoiceGroupMergeInput[]): MergedVoiceGroups {
  const merged: VoiceBilingualFields = { en: {}, gu: {}, sources: {} }
  const warnings: string[] = []

  for (const group of groups) {
    for (const field of STRING_FIELDS) {
      for (const script of ['en', 'gu'] as const) {
        const parsed = group.fields[script][field]
        if (parsed) merged[script][field] = { ...parsed }
      }
      if (group.fields.sources[field]) {
        merged.sources[field] = { ...group.fields.sources[field] }
      }
    }
    if (group.warning) warnings.push(group.warning)
  }

  const fields = createVoiceBilingualFields(
    sanitizeMergedScript(merged, 'en'),
    sanitizeMergedScript(merged, 'gu')
  )

  return {
    fields,
    warning: warnings.join(' | ') || null,
  }
}

export function voiceResultsInGroupOrder(
  results: Partial<Record<VoiceGroupId, VoiceEntryResponse>>
): VoiceEntryResponse[] {
  return VOICE_GROUP_ORDER.flatMap((group) => results[group] ? [results[group]!] : [])
}

/** Stable transcript rebuild prevents duplicate/stale audit sections on re-record. */
export function buildSpokenAuditText(
  results: Partial<Record<VoiceGroupId, VoiceEntryResponse>>
): string {
  return VOICE_GROUP_ORDER.flatMap((group) => {
    const transcript = results[group]?.transcript.trim()
    if (!transcript) return []
    return [`===== SPOKEN (${VOICE_FIELD_GROUPS[group].title}) =====\n${transcript}`]
  }).join('\n\n')
}
