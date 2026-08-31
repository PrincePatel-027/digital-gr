import { STRING_FIELDS, toParsedRecord } from './extract-shared'
import type { ParsedField, ParsedGRFields } from './ocr-parser'
import { VOICE_FIELD_GROUPS, VOICE_GROUP_ORDER } from './voice-fields'
import type { VoiceEntryResponse, VoiceGroupId } from './voice-types'

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
  fields: ParsedGRFields
  warning?: string | null
}

export interface MergedVoiceGroups {
  fields: ParsedGRFields
  warning: string | null
}

function lowerConfidence(
  a: ParsedField['confidence'],
  b: ParsedField['confidence']
): ParsedField['confidence'] {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b
}

/**
 * Merge the latest result for each dictated group. Later inputs win on the same
 * field (used when a group is re-recorded), then shared sanitation and the OCR
 * admission/leaving ambiguity pass run exactly once on the complete candidate.
 */
export function mergeVoiceGroups(groups: readonly VoiceGroupMergeInput[]): MergedVoiceGroups {
  const merged: ParsedGRFields = {}
  const warnings: string[] = []

  for (const group of groups) {
    for (const field of STRING_FIELDS) {
      const value = group.fields[field]
      if (value) merged[field] = { ...value }
    }
    if (group.warning) warnings.push(group.warning)
  }

  const raw = Object.fromEntries(
    STRING_FIELDS.flatMap((field) => merged[field] ? [[field, merged[field]!.value]] : [])
  )
  const sanitized = toParsedRecord(raw, 'high', {
    allowedFields: STRING_FIELDS,
    requireIdentity: false,
    downgradeAdmissionLeavingAmbiguity: true,
  }) ?? {}

  for (const field of STRING_FIELDS) {
    const finalField = sanitized[field]
    const original = merged[field]
    if (!finalField || !original) continue
    finalField.confidence = NAME_FIELDS.includes(field)
      ? 'medium'
      : lowerConfidence(finalField.confidence, original.confidence)
  }

  return {
    fields: sanitized,
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
