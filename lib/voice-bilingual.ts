import {
  GR_RECORD_FIELD_ORDER,
  type GRRecordData,
  type GRRecordField,
} from './gr-record-data'
import {
  getGujaratDistrict,
  getGujaratSubdistrict,
  resolveGujaratDistrict,
  resolveGujaratSubdistrict,
} from './gujarat-locations'
import type { ParsedField, ParsedGRFields } from './ocr-parser'
import type {
  VoiceBilingualFields,
  VoiceEnglishMetadata,
  VoiceFieldSource,
  VoiceReviewFields,
  VoiceScript,
} from './voice-types'

export const VOICE_PARSED_INVARIANT_FIELDS = [
  'gr_number',
  'date_of_birth',
  'admission_date',
  'leaving_date',
] as const satisfies readonly GRRecordField[]

/**
 * These values are identifiers, normalized ISO dates, storage pointers, or the
 * verbatim audit trail. Converting them would corrupt identity or evidence, so
 * every voice conversion and English-metadata path must exclude them.
 */
export const VOICE_CONVERSION_EXCLUDED_FIELDS = [
  ...VOICE_PARSED_INVARIANT_FIELDS,
  'image_url',
  'ocr_raw_text',
] as const satisfies readonly (keyof GRRecordData)[]

export const VOICE_REQUIRED_NAME_FIELDS = [
  'student_name',
  'fathers_name',
  'surname',
] as const satisfies readonly GRRecordField[]

const INVARIANT_FIELDS = new Set<GRRecordField>(VOICE_PARSED_INVARIANT_FIELDS)
const METADATA_EXCLUDED_FIELDS = new Set<keyof GRRecordData>(VOICE_CONVERSION_EXCLUDED_FIELDS)
const LOCATION_FIELDS = new Set<GRRecordField>([
  'previous_school_district',
  'previous_school_subdistrict',
])

function hasValue(field: ParsedField | undefined): field is ParsedField {
  return Boolean(field?.value.trim())
}

function cloneField(field: ParsedField): ParsedField {
  return { value: field.value, confidence: field.confidence }
}

function cloneParsedFields(fields: ParsedGRFields): ParsedGRFields {
  const clone: ParsedGRFields = {}
  for (const field of GR_RECORD_FIELD_ORDER) {
    if (fields[field]) clone[field] = cloneField(fields[field]!)
  }
  return clone
}

function sourceConfidence(...fields: Array<ParsedField | undefined>): ParsedField['confidence'] {
  return fields.find(hasValue)?.confidence ?? 'medium'
}

function setCanonicalLocation(
  output: VoiceBilingualFields,
  field: 'previous_school_district' | 'previous_school_subdistrict',
  key: string,
  confidence: ParsedField['confidence']
): void {
  output.en[field] = { value: key, confidence }
  output.gu[field] = { value: key, confidence }
  output.sources[field] = { en: 'canonical-lgd', gu: 'canonical-lgd' }
}

/**
 * Builds the isolated voice contract from independently extracted scripts.
 * Missing Gujarati text remains missing: proper nouns are never guessed or
 * copied from English. Canonical locations are resolved locally to LGD keys.
 */
export function createVoiceBilingualFields(
  en: ParsedGRFields,
  gu: ParsedGRFields,
  source: VoiceFieldSource = 'ai'
): VoiceBilingualFields {
  const output: VoiceBilingualFields = { en: {}, gu: {}, sources: {} }

  for (const field of GR_RECORD_FIELD_ORDER) {
    if (LOCATION_FIELDS.has(field)) continue

    if (INVARIANT_FIELDS.has(field)) {
      const shared = hasValue(en[field]) ? en[field] : hasValue(gu[field]) ? gu[field] : undefined
      if (!shared) continue
      output.en[field] = cloneField(shared)
      output.gu[field] = cloneField(shared)
      output.sources[field] = { en: 'shared', gu: 'shared' }
      continue
    }

    const english = en[field]
    const gujarati = gu[field]
    if (hasValue(english)) output.en[field] = cloneField(english)
    if (hasValue(gujarati)) output.gu[field] = cloneField(gujarati)
    if (hasValue(english) || hasValue(gujarati)) {
      output.sources[field] = {
        en: hasValue(english) ? source : undefined,
        gu: hasValue(gujarati) ? source : undefined,
      }
    }
  }

  const district = resolveGujaratDistrict(en.previous_school_district?.value)
    ?? resolveGujaratDistrict(gu.previous_school_district?.value)
  const subdistrict = resolveGujaratSubdistrict(
    en.previous_school_subdistrict?.value,
    district?.key
  ) ?? resolveGujaratSubdistrict(
    gu.previous_school_subdistrict?.value,
    district?.key
  )
  const canonicalDistrict = district
    ?? (subdistrict ? getGujaratDistrict(subdistrict.districtKey) : null)

  if (canonicalDistrict) {
    setCanonicalLocation(
      output,
      'previous_school_district',
      canonicalDistrict.key,
      sourceConfidence(en.previous_school_district, gu.previous_school_district)
    )
  }
  if (subdistrict && (!canonicalDistrict || subdistrict.districtKey === canonicalDistrict.key)) {
    setCanonicalLocation(
      output,
      'previous_school_subdistrict',
      subdistrict.key,
      sourceConfidence(en.previous_school_subdistrict, gu.previous_school_subdistrict)
    )
  }

  return output
}

export function isVoiceBilingualFields(value: VoiceReviewFields): value is VoiceBilingualFields {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<VoiceBilingualFields>
  return Boolean(
    candidate.en && typeof candidate.en === 'object' &&
    candidate.gu && typeof candidate.gu === 'object' &&
    candidate.sources && typeof candidate.sources === 'object'
  )
}

export function cloneVoiceBilingualFields(fields: VoiceBilingualFields): VoiceBilingualFields {
  return {
    en: cloneParsedFields(fields.en),
    gu: cloneParsedFields(fields.gu),
    sources: Object.fromEntries(
      Object.entries(fields.sources).map(([field, sources]) => [field, { ...sources }])
    ) as VoiceBilingualFields['sources'],
  }
}

/** Backward-compatible adapter for a legacy/single-script voice row. */
export function coerceVoiceBilingualFields(fields: VoiceReviewFields): VoiceBilingualFields {
  if (isVoiceBilingualFields(fields)) return cloneVoiceBilingualFields(fields)
  return createVoiceBilingualFields(fields, fields, 'single-script')
}

export function voiceFieldsForScript(
  fields: VoiceReviewFields,
  script: VoiceScript
): ParsedGRFields {
  if (!isVoiceBilingualFields(fields)) return cloneParsedFields(fields)
  return cloneParsedFields(fields[script])
}

export function updateVoiceField(
  fields: VoiceBilingualFields,
  script: VoiceScript,
  field: GRRecordField,
  value: string
): VoiceBilingualFields {
  const next = cloneVoiceBilingualFields(fields)
  const confidence = next[script][field]?.confidence ?? 'medium'

  if (INVARIANT_FIELDS.has(field)) {
    if (value) {
      next.en[field] = { value, confidence }
      next.gu[field] = { value, confidence }
      next.sources[field] = { en: 'shared', gu: 'shared' }
    } else {
      delete next.en[field]
      delete next.gu[field]
      delete next.sources[field]
    }
    return next
  }

  if (field === 'previous_school_district') {
    const district = getGujaratDistrict(value)
    if (!district) {
      delete next.en.previous_school_district
      delete next.gu.previous_school_district
      delete next.sources.previous_school_district
      delete next.en.previous_school_subdistrict
      delete next.gu.previous_school_subdistrict
      delete next.sources.previous_school_subdistrict
      return next
    }

    setCanonicalLocation(next, field, district.key, confidence)
    const subdistrict = getGujaratSubdistrict(next.en.previous_school_subdistrict?.value)
    if (subdistrict?.districtKey !== district.key) {
      delete next.en.previous_school_subdistrict
      delete next.gu.previous_school_subdistrict
      delete next.sources.previous_school_subdistrict
    }
    return next
  }

  if (field === 'previous_school_subdistrict') {
    if (!value) {
      delete next.en[field]
      delete next.gu[field]
      delete next.sources[field]
      return next
    }
    const subdistrict = getGujaratSubdistrict(value)
    const districtKey = next.en.previous_school_district?.value
    if (!subdistrict || (districtKey && subdistrict.districtKey !== districtKey)) return next
    if (!districtKey) {
      setCanonicalLocation(next, 'previous_school_district', subdistrict.districtKey, confidence)
    }
    setCanonicalLocation(next, field, subdistrict.key, confidence)
    return next
  }

  if (value) {
    next[script][field] = { value, confidence }
    next.sources[field] = { ...next.sources[field], [script]: 'clerk' }
  } else {
    delete next[script][field]
    const remainingSources = { ...next.sources[field] }
    delete remainingSources[script]
    if (remainingSources.en || remainingSources.gu) next.sources[field] = remainingSources
    else delete next.sources[field]
  }
  return next
}

export function voiceEnglishMetadata(fields: VoiceReviewFields): VoiceEnglishMetadata {
  const dual = coerceVoiceBilingualFields(fields)
  const metadata: VoiceEnglishMetadata = {}

  for (const field of GR_RECORD_FIELD_ORDER) {
    if (METADATA_EXCLUDED_FIELDS.has(field)) continue
    const english = dual.en[field]
    if (!hasValue(english)) continue
    metadata[field] = {
      value: english.value,
      confidence: english.confidence,
      source: dual.sources[field]?.en ?? 'single-script',
    }
  }

  return metadata
}

export function requiredAiGujaratiNameFields(
  fields: VoiceBilingualFields
): readonly (typeof VOICE_REQUIRED_NAME_FIELDS)[number][] {
  return VOICE_REQUIRED_NAME_FIELDS.filter((field) => (
    hasValue(fields.gu[field]) && fields.sources[field]?.gu === 'ai'
  ))
}

const FIELD_SOURCE_VALUES = new Set<VoiceFieldSource>([
  'ai',
  'canonical-lgd',
  'shared',
  'clerk',
  'single-script',
])
const CONFIDENCE_VALUES = new Set<ParsedField['confidence']>(['high', 'medium', 'low'])

export function parseVoiceEnglishMetadata(value: unknown): VoiceEnglishMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const metadata: VoiceEnglishMetadata = {}

  for (const field of GR_RECORD_FIELD_ORDER) {
    if (METADATA_EXCLUDED_FIELDS.has(field)) continue
    const candidate = source[field]
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const entry = candidate as Record<string, unknown>
    if (
      typeof entry.value !== 'string' || !entry.value.trim() ||
      typeof entry.source !== 'string' || !FIELD_SOURCE_VALUES.has(entry.source as VoiceFieldSource) ||
      typeof entry.confidence !== 'string' || !CONFIDENCE_VALUES.has(entry.confidence as ParsedField['confidence'])
    ) continue
    metadata[field] = {
      value: entry.value,
      source: entry.source as VoiceFieldSource,
      confidence: entry.confidence as ParsedField['confidence'],
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : null
}

/** Rebuilds editable dual-script state from Gujarati columns plus fields_en JSON. */
export function hydrateVoiceBilingualFields(
  record: GRRecordData,
  rawMetadata: unknown = record.fields_en
): VoiceBilingualFields | null {
  const metadata = parseVoiceEnglishMetadata(rawMetadata)
  if (!metadata) return null

  const en: ParsedGRFields = {}
  const gu: ParsedGRFields = {}
  for (const field of GR_RECORD_FIELD_ORDER) {
    const mainValue = record[field]
    const english = metadata[field]
    if (mainValue.trim()) {
      gu[field] = {
        value: mainValue,
        confidence: english?.confidence ?? 'medium',
      }
    }
    if (english) {
      en[field] = { value: english.value, confidence: english.confidence }
    } else if (INVARIANT_FIELDS.has(field) || LOCATION_FIELDS.has(field)) {
      if (mainValue.trim()) en[field] = { value: mainValue, confidence: 'medium' }
    }
  }

  const dual = createVoiceBilingualFields(en, gu, 'clerk')
  for (const field of GR_RECORD_FIELD_ORDER) {
    const english = metadata[field]
    if (english && dual.en[field]) {
      dual.sources[field] = {
        ...dual.sources[field],
        en: english.source,
        gu: dual.sources[field]?.gu === 'shared' || dual.sources[field]?.gu === 'canonical-lgd'
          ? dual.sources[field]?.gu
          : 'clerk',
      }
    }
  }
  return dual
}
