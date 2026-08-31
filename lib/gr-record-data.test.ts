import { describe, expect, it } from 'vitest'
import type { ParsedGRFields } from './ocr-parser'
import {
  buildGRRecordPayload,
  EMPTY_GR_RECORD,
  mergeParsedValues,
} from './gr-record-data'

describe('GR record payload mapping', () => {
  it('maps merged ParsedGRFields and coerces optional empty strings to null', () => {
    const mergedFields: ParsedGRFields = {
      gr_number: { value: ' 1247 ', confidence: 'high' },
      student_name: { value: 'Jagdish', confidence: 'medium' },
      fathers_name: { value: 'Ramesh', confidence: 'medium' },
      surname: { value: 'Dixit', confidence: 'medium' },
      date_of_birth: { value: '2016-01-06', confidence: 'high' },
      admission_date: { value: '2022-06-10', confidence: 'high' },
      admission_standard: { value: '1', confidence: 'high' },
    }
    const form = mergeParsedValues({
      ...EMPTY_GR_RECORD,
      ocr_raw_text: '===== SPOKEN (Identity) =====\nStudent Jagdish Dixit.',
    }, mergedFields)

    expect(buildGRRecordPayload(form)).toEqual({
      gr_number: '1247',
      student_name: 'Jagdish',
      fathers_name: 'Ramesh',
      mothers_name: null,
      surname: 'Dixit',
      religion: null,
      caste_category: null,
      date_of_birth: '2016-01-06',
      dob_in_words: null,
      birth_place: null,
      address: null,
      previous_school: null,
      admission_date: '2022-06-10',
      admission_standard: '1',
      progress_and_conduct: null,
      leaving_date: null,
      leaving_reason: null,
      leaving_standard: null,
      remarks: null,
      image_url: null,
      ocr_raw_text: '===== SPOKEN (Identity) =====\nStudent Jagdish Dixit.',
    })
  })
})
