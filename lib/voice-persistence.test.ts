import { describe, expect, it, vi } from 'vitest'
import type { ParsedGRFields } from './ocr-parser'
import { createVoiceBilingualFields } from './voice-bilingual'
import {
  buildVoiceGRRecordPayload,
  prepareVoiceGRRecordBatch,
  saveVoiceGRRecordBatch,
} from './voice-persistence'
import type { GRRecordInsertPayload } from './gr-record-batch'

function completeStudent(
  grNumber: string,
  studentName: string,
  fatherName: string,
  surname: string
): ParsedGRFields {
  return {
    gr_number: { value: grNumber, confidence: 'high' },
    student_name: { value: studentName, confidence: 'medium' },
    fathers_name: { value: fatherName, confidence: 'medium' },
    surname: { value: surname, confidence: 'medium' },
    date_of_birth: { value: '2016-01-06', confidence: 'high' },
    admission_date: { value: '2022-06-10', confidence: 'high' },
  }
}

describe('voice persistence', () => {
  it('writes Gujarati columns, English metadata, and untouched audit values', () => {
    const dual = createVoiceBilingualFields(
      {
        ...completeStudent('42', 'Jagdish', 'Ramesh', 'Dixit'),
        previous_school_district: { value: 'Ahmedabad', confidence: 'high' },
        previous_school_subdistrict: { value: 'Sanand', confidence: 'high' },
      },
      {
        ...completeStudent('wrong identifier', 'જગદીશ', 'રમેશ', 'દીક્ષિત'),
        date_of_birth: { value: 'wrong date', confidence: 'low' },
        admission_date: { value: 'wrong date', confidence: 'low' },
        previous_school_district: { value: 'અમદાવાદ', confidence: 'high' },
        previous_school_subdistrict: { value: 'સાણંદ', confidence: 'high' },
      }
    )

    const payload = buildVoiceGRRecordPayload(dual, {
      imageUrl: 'voice-source.webm',
      ocrRawText: '===== SPOKEN (Identity) =====\nStudent Jagdish Dixit.',
    })

    expect(payload).toMatchObject({
      gr_number: '42',
      student_name: 'જગદીશ',
      fathers_name: 'રમેશ',
      surname: 'દીક્ષિત',
      date_of_birth: '2016-01-06',
      admission_date: '2022-06-10',
      previous_school_district: 'district:438',
      previous_school_subdistrict: 'subdistrict:3780',
      image_url: 'voice-source.webm',
      ocr_raw_text: '===== SPOKEN (Identity) =====\nStudent Jagdish Dixit.',
    })
    expect(payload.fields_en.student_name).toEqual({
      value: 'Jagdish',
      source: 'ai',
      confidence: 'medium',
    })
    expect(payload.fields_en.previous_school_district?.value).toBe('district:438')
    expect(payload.fields_en.gr_number).toBeUndefined()
    expect(payload.fields_en.date_of_birth).toBeUndefined()
    expect(payload.fields_en.admission_date).toBeUndefined()
    expect(payload.fields_en.leaving_date).toBeUndefined()
    expect(payload.fields_en).not.toHaveProperty('image_url')
    expect(payload.fields_en).not.toHaveProperty('ocr_raw_text')
  })

  it('marks a row invalid when Gujarati required values are absent', () => {
    const dual = createVoiceBilingualFields(completeStudent('42', 'Jagdish', 'Ramesh', 'Dixit'), {
      gr_number: { value: '42', confidence: 'high' },
      date_of_birth: { value: '2016-01-06', confidence: 'high' },
      admission_date: { value: '2022-06-10', confidence: 'high' },
    })

    const [row] = prepareVoiceGRRecordBatch([dual])

    expect(row.status).toBe('invalid')
    expect(row.missingFields).toEqual(['student_name', 'fathers_name', 'surname'])
  })

  it('saves one dual-script and one legacy single-script row in the same batch', async () => {
    const dual = createVoiceBilingualFields(
      completeStudent('42', 'Jagdish', 'Ramesh', 'Dixit'),
      completeStudent('42', 'જગદીશ', 'રમેશ', 'દીક્ષિત')
    )
    const single = completeStudent('43', 'Mira', 'Ketan', 'Patel')
    const inserted: GRRecordInsertPayload[] = []
    const insertOne = vi.fn(async (payload: GRRecordInsertPayload) => {
      inserted.push(payload)
    })

    const result = await saveVoiceGRRecordBatch([dual, single], {
      schoolId: 'school-1',
      createdBy: 'user-1',
      ocrRawText: '===== SPOKEN (Multiple entries) =====\nTwo entries.',
      findExisting: vi.fn(async () => []),
      insertOne,
    })

    expect(result.savedCount).toBe(2)
    expect(inserted).toHaveLength(2)
    expect(inserted[0]).toMatchObject({
      gr_number: '42',
      student_name: 'જગદીશ',
      fathers_name: 'રમેશ',
      surname: 'દીક્ષિત',
      school_id: 'school-1',
      created_by: 'user-1',
    })
    expect(inserted[0].fields_en?.student_name).toMatchObject({
      value: 'Jagdish',
      source: 'ai',
    })
    expect(inserted[1]).toMatchObject({
      gr_number: '43',
      student_name: 'Mira',
      fathers_name: 'Ketan',
      surname: 'Patel',
    })
    expect(inserted[1].fields_en?.student_name).toMatchObject({
      value: 'Mira',
      source: 'single-script',
    })
    expect(inserted.every((payload) => payload.ocr_raw_text?.includes('Two entries.'))).toBe(true)
  })
})
