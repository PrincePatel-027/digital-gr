import { describe, expect, it } from 'vitest'
import type { ParsedGRFields } from './ocr-parser'
import { EMPTY_GR_RECORD } from './gr-record-data'
import {
  coerceVoiceBilingualFields,
  createVoiceBilingualFields,
  hydrateVoiceBilingualFields,
  parseVoiceEnglishMetadata,
  requiredAiGujaratiNameFields,
  updateVoiceField,
  VOICE_CONVERSION_EXCLUDED_FIELDS,
  voiceEnglishMetadata,
  voiceFieldsForScript,
} from './voice-bilingual'

const english: ParsedGRFields = {
  gr_number: { value: '1247', confidence: 'high' },
  student_name: { value: 'Jagdish', confidence: 'high' },
  fathers_name: { value: 'Ramesh', confidence: 'high' },
  surname: { value: 'Dixit', confidence: 'high' },
  date_of_birth: { value: '2016-01-06', confidence: 'high' },
  previous_school: { value: 'Sunrise Primary School', confidence: 'medium' },
  previous_school_district: { value: 'Ahmedabad', confidence: 'medium' },
  previous_school_subdistrict: { value: 'Sanand', confidence: 'medium' },
  admission_date: { value: '2022-06-10', confidence: 'high' },
}

const gujarati: ParsedGRFields = {
  gr_number: { value: 'not allowed to replace 1247', confidence: 'low' },
  student_name: { value: 'જગદીશ', confidence: 'high' },
  fathers_name: { value: 'રમેશ', confidence: 'high' },
  surname: { value: 'દીક્ષિત', confidence: 'high' },
  date_of_birth: { value: 'not allowed to replace 2016-01-06', confidence: 'low' },
  previous_school: { value: 'સનરાઇઝ પ્રાથમિક શાળા', confidence: 'medium' },
  previous_school_district: { value: 'district:438', confidence: 'high' },
  previous_school_subdistrict: { value: 'સાણંદ', confidence: 'high' },
  admission_date: { value: 'not allowed to replace 2022-06-10', confidence: 'low' },
}

describe('voice bilingual conversion', () => {
  it('enforces the complete hard exclusion list', () => {
    expect(VOICE_CONVERSION_EXCLUDED_FIELDS).toEqual([
      'gr_number',
      'date_of_birth',
      'admission_date',
      'leaving_date',
      'image_url',
      'ocr_raw_text',
    ])
  })

  it('preserves both scripts while keeping invariant values byte-for-byte shared', () => {
    const dual = createVoiceBilingualFields(english, gujarati)

    expect(dual.en.student_name?.value).toBe('Jagdish')
    expect(dual.gu.student_name?.value).toBe('જગદીશ')
    expect(dual.sources.student_name).toEqual({ en: 'ai', gu: 'ai' })
    expect(dual.en.gr_number?.value).toBe('1247')
    expect(dual.gu.gr_number?.value).toBe('1247')
    expect(dual.sources.gr_number).toEqual({ en: 'shared', gu: 'shared' })
    expect(dual.en.date_of_birth?.value).toBe('2016-01-06')
    expect(dual.gu.admission_date?.value).toBe('2022-06-10')
  })

  it('canonicalizes locations locally and stores the same LGD keys in both scripts', () => {
    const dual = createVoiceBilingualFields(english, gujarati)

    expect(dual.en.previous_school_district?.value).toBe('district:438')
    expect(dual.gu.previous_school_district?.value).toBe('district:438')
    expect(dual.en.previous_school_subdistrict?.value).toBe('subdistrict:3780')
    expect(dual.gu.previous_school_subdistrict?.value).toBe('subdistrict:3780')
    expect(dual.sources.previous_school_subdistrict).toEqual({
      en: 'canonical-lgd',
      gu: 'canonical-lgd',
    })
  })

  it('leaves an uncertain Gujarati proper noun empty instead of guessing or copying English', () => {
    const dual = createVoiceBilingualFields(
      { student_name: { value: 'Jagdish', confidence: 'medium' } },
      {}
    )

    expect(dual.en.student_name?.value).toBe('Jagdish')
    expect(dual.gu.student_name).toBeUndefined()
    expect(dual.sources.student_name).toEqual({ en: 'ai', gu: undefined })
  })

  it('adapts a legacy single-script row without making it look AI-transliterated', () => {
    const dual = coerceVoiceBilingualFields(english)

    expect(voiceFieldsForScript(dual, 'gu').student_name?.value).toBe('Jagdish')
    expect(dual.sources.student_name).toEqual({
      en: 'single-script',
      gu: 'single-script',
    })
    expect(dual.sources.gr_number).toEqual({ en: 'shared', gu: 'shared' })
  })

  it('persists only convertible English fields with per-field provenance', () => {
    const metadata = voiceEnglishMetadata(createVoiceBilingualFields(english, gujarati))

    expect(metadata.student_name).toEqual({
      value: 'Jagdish',
      confidence: 'high',
      source: 'ai',
    })
    expect(metadata.previous_school_district).toEqual({
      value: 'district:438',
      confidence: 'medium',
      source: 'canonical-lgd',
    })
    expect(metadata.gr_number).toBeUndefined()
    expect(metadata.date_of_birth).toBeUndefined()
    expect(metadata.admission_date).toBeUndefined()
  })

  it('edits one script independently but updates excluded and canonical fields together', () => {
    const initial = createVoiceBilingualFields(english, gujarati)
    const renamed = updateVoiceField(initial, 'gu', 'student_name', 'જગદીશકુમાર')
    const renumbered = updateVoiceField(renamed, 'gu', 'gr_number', '2001')
    const districtChanged = updateVoiceField(
      renumbered,
      'en',
      'previous_school_district',
      'district:439'
    )

    expect(renamed.en.student_name?.value).toBe('Jagdish')
    expect(renamed.gu.student_name?.value).toBe('જગદીશકુમાર')
    expect(renamed.sources.student_name?.gu).toBe('clerk')
    expect(renumbered.en.gr_number?.value).toBe('2001')
    expect(renumbered.gu.gr_number?.value).toBe('2001')
    expect(districtChanged.en.previous_school_district?.value).toBe('district:439')
    expect(districtChanged.gu.previous_school_district?.value).toBe('district:439')
    expect(districtChanged.en.previous_school_subdistrict).toBeUndefined()
    expect(districtChanged.gu.previous_school_subdistrict).toBeUndefined()
  })

  it('identifies only AI-sourced required Gujarati name fields for the review gate', () => {
    const dual = createVoiceBilingualFields(english, gujarati)
    const edited = updateVoiceField(dual, 'gu', 'student_name', 'જગદીશકુમાર')

    expect(requiredAiGujaratiNameFields(dual)).toEqual([
      'student_name',
      'fathers_name',
      'surname',
    ])
    expect(requiredAiGujaratiNameFields(edited)).toEqual([
      'fathers_name',
      'surname',
    ])
  })
})

describe('stored English voice metadata', () => {
  it('rejects malformed entries and hydrates a reviewed dual-script edit state', () => {
    const metadata = parseVoiceEnglishMetadata({
      student_name: { value: 'Jagdish', source: 'ai', confidence: 'medium' },
      fathers_name: { value: 'Ramesh', source: 'ai', confidence: 'medium' },
      surname: { value: 'Dixit', source: 'clerk', confidence: 'high' },
      gr_number: { value: 'must be ignored', source: 'ai', confidence: 'high' },
      remarks: { value: '', source: 'unknown', confidence: 'impossible' },
    })

    expect(metadata).toEqual({
      student_name: { value: 'Jagdish', source: 'ai', confidence: 'medium' },
      fathers_name: { value: 'Ramesh', source: 'ai', confidence: 'medium' },
      surname: { value: 'Dixit', source: 'clerk', confidence: 'high' },
    })

    const hydrated = hydrateVoiceBilingualFields({
      ...EMPTY_GR_RECORD,
      gr_number: '1247',
      student_name: 'જગદીશ',
      fathers_name: 'રમેશ',
      surname: 'દીક્ષિત',
      date_of_birth: '2016-01-06',
      admission_date: '2022-06-10',
      fields_en: metadata,
    })

    expect(hydrated?.en.student_name?.value).toBe('Jagdish')
    expect(hydrated?.gu.student_name?.value).toBe('જગદીશ')
    expect(hydrated?.en.gr_number?.value).toBe('1247')
    expect(hydrated?.gu.gr_number?.value).toBe('1247')
    expect(hydrated?.sources.student_name).toEqual({ en: 'ai', gu: 'clerk' })
    expect(requiredAiGujaratiNameFields(hydrated!)).toEqual([])
  })

  it('returns null for absent or unusable metadata so OCR rows stay single-script', () => {
    expect(parseVoiceEnglishMetadata(null)).toBeNull()
    expect(parseVoiceEnglishMetadata({ gr_number: { value: '42', source: 'ai', confidence: 'high' } })).toBeNull()
    expect(hydrateVoiceBilingualFields({ ...EMPTY_GR_RECORD, student_name: 'OCR name' })).toBeNull()
  })
})
