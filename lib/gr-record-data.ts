import type { ParsedGRFields } from './ocr-parser'

export interface GRRecordData {
  id?: string
  gr_number: string
  student_name: string
  fathers_name: string
  mothers_name: string
  surname: string
  religion: string
  caste_category: string
  date_of_birth: string
  dob_in_words: string
  birth_place: string
  address: string
  previous_school: string
  admission_date: string
  admission_standard: string
  progress_and_conduct: string
  leaving_date: string
  leaving_reason: string
  leaving_standard: string
  remarks: string
  image_url: string
  ocr_raw_text: string
}

export const EMPTY_GR_RECORD: GRRecordData = {
  gr_number: '',
  student_name: '',
  fathers_name: '',
  mothers_name: '',
  surname: '',
  religion: '',
  caste_category: '',
  date_of_birth: '',
  dob_in_words: '',
  birth_place: '',
  address: '',
  previous_school: '',
  admission_date: '',
  admission_standard: '',
  progress_and_conduct: '',
  leaving_date: '',
  leaving_reason: '',
  leaving_standard: '',
  remarks: '',
  image_url: '',
  ocr_raw_text: '',
}

/** Pure value merge used by form extraction sources and payload tests. */
export function mergeParsedValues(
  record: GRRecordData,
  parsed: ParsedGRFields
): GRRecordData {
  const merged = { ...record }
  for (const field of Object.keys(parsed) as (keyof ParsedGRFields)[]) {
    const value = parsed[field]?.value
    if (value) merged[field] = value
  }
  return merged
}

/** Database-ready values shared by insert and update; optional blanks become null. */
export function buildGRRecordPayload(form: GRRecordData) {
  return {
    gr_number: form.gr_number.trim(),
    student_name: form.student_name.trim(),
    fathers_name: form.fathers_name.trim(),
    mothers_name: form.mothers_name.trim() || null,
    surname: form.surname.trim(),
    religion: form.religion.trim() || null,
    caste_category: form.caste_category.trim() || null,
    date_of_birth: form.date_of_birth,
    dob_in_words: form.dob_in_words.trim() || null,
    birth_place: form.birth_place.trim() || null,
    address: form.address.trim() || null,
    previous_school: form.previous_school.trim() || null,
    admission_date: form.admission_date,
    admission_standard: form.admission_standard.trim() || null,
    progress_and_conduct: form.progress_and_conduct.trim() || null,
    leaving_date: form.leaving_date || null,
    leaving_reason: form.leaving_reason.trim() || null,
    leaving_standard: form.leaving_standard.trim() || null,
    remarks: form.remarks.trim() || null,
    image_url: form.image_url.trim() || null,
    ocr_raw_text: form.ocr_raw_text.trim() || null,
  }
}
