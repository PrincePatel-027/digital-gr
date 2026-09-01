import { describe, expect, it, vi } from 'vitest'
import {
  formatGRRecordBatchSummary,
  getMissingGRRecordFields,
  prepareGRRecordBatch,
  saveGRRecordBatch,
  type GRRecordInsertPayload,
} from './gr-record-batch'
import {
  GR_RECORD_FIELD_ORDER,
  GR_RECORD_REQUIRED_FIELDS,
} from './gr-record-data'
import type { ParsedGRFields } from './ocr-parser'

function student(grNumber: string, overrides: ParsedGRFields = {}): ParsedGRFields {
  return {
    gr_number: { value: grNumber, confidence: 'high' },
    student_name: { value: `Student ${grNumber}`, confidence: 'medium' },
    fathers_name: { value: `Father ${grNumber}`, confidence: 'medium' },
    surname: { value: 'Patel', confidence: 'medium' },
    date_of_birth: { value: '2016-01-06', confidence: 'high' },
    admission_date: { value: '2022-06-10', confidence: 'high' },
    ...overrides,
  }
}

function options(overrides: Partial<{
  findExisting: (grNumbers: readonly string[]) => Promise<readonly string[]>
  insertOne: (payload: GRRecordInsertPayload) => Promise<void>
}> = {}) {
  return {
    schoolId: 'school-1',
    createdBy: 'user-1',
    findExisting: overrides.findExisting ?? vi.fn(async () => []),
    insertOne: overrides.insertOne ?? vi.fn(async () => undefined),
  }
}

describe('GR record batch metadata and preparation', () => {
  it('shares all 19 ordered fields and the six required fields', () => {
    expect(GR_RECORD_FIELD_ORDER).toHaveLength(19)
    expect(GR_RECORD_REQUIRED_FIELDS).toEqual([
      'gr_number',
      'student_name',
      'fathers_name',
      'surname',
      'date_of_birth',
      'admission_date',
    ])
  })

  it('reports required blanks and maps optional blanks through the existing payload builder', () => {
    const incomplete: ParsedGRFields = {
      gr_number: { value: ' 42 ', confidence: 'high' },
      student_name: { value: 'Jagdish', confidence: 'medium' },
      mothers_name: { value: '   ', confidence: 'low' },
    }

    expect(getMissingGRRecordFields(incomplete)).toEqual([
      'fathers_name',
      'surname',
      'date_of_birth',
      'admission_date',
    ])

    const [row] = prepareGRRecordBatch([incomplete], {
      imageUrl: null,
      ocrRawText: '===== SPOKEN (Multiple entries) =====\nEntry one.',
    })

    expect(row.status).toBe('invalid')
    expect(row.grNumber).toBe('42')
    expect(row.payload.mothers_name).toBeNull()
    expect(row.payload.image_url).toBeNull()
    expect(row.payload.ocr_raw_text).toBe(
      '===== SPOKEN (Multiple entries) =====\nEntry one.'
    )
  })

  it('skips every occurrence of an internal GR duplicate', async () => {
    const findExisting = vi.fn(async () => [] as string[])
    const insertOne = vi.fn(async (payload: GRRecordInsertPayload) => {
      void payload
    })

    const result = await saveGRRecordBatch(
      [student(' 42 '), student('42'), student('43')],
      options({ findExisting, insertOne })
    )

    expect(result.rows.map((row) => [row.grNumber, row.status, row.reason])).toEqual([
      ['42', 'skipped', 'duplicate-in-batch'],
      ['42', 'skipped', 'duplicate-in-batch'],
      ['43', 'saved', null],
    ])
    expect(findExisting).toHaveBeenCalledOnce()
    expect(findExisting).toHaveBeenCalledWith(['43'])
    expect(insertOne).toHaveBeenCalledOnce()
    expect(insertOne.mock.calls[0][0].gr_number).toBe('43')
  })
})

describe('saveGRRecordBatch', () => {
  it('preflights once, skips existing rows, and enriches each inserted payload', async () => {
    const findExisting = vi.fn(async () => ['42'])
    const inserted: GRRecordInsertPayload[] = []
    const insertOne = vi.fn(async (payload: GRRecordInsertPayload) => {
      inserted.push(payload)
    })

    const result = await saveGRRecordBatch(
      [student('42'), student('43'), student('44'), student('45')],
      {
        ...options({ findExisting, insertOne }),
        imageUrl: null,
        ocrRawText: '===== SPOKEN (Multiple entries) =====\nFour entries.',
      }
    )

    expect(findExisting).toHaveBeenCalledOnce()
    expect(findExisting).toHaveBeenCalledWith(['42', '43', '44', '45'])
    expect(inserted.map((payload) => payload.gr_number)).toEqual(['43', '44', '45'])
    expect(inserted.every((payload) => (
      payload.school_id === 'school-1' &&
      payload.created_by === 'user-1' &&
      payload.image_url === null &&
      payload.ocr_raw_text === '===== SPOKEN (Multiple entries) =====\nFour entries.'
    ))).toBe(true)
    expect(formatGRRecordBatchSummary(result)).toBe(
      '3 saved, 1 skipped: GR 42 already exists.'
    )
  })

  it('awaits inserts sequentially and continues after an ordinary row failure', async () => {
    const events: string[] = []
    let active = 0
    let maximumActive = 0
    const insertOne = vi.fn(async (payload: GRRecordInsertPayload) => {
      events.push(`start-${payload.gr_number}`)
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await Promise.resolve()
      active -= 1
      if (payload.gr_number === '43') {
        events.push('fail-43')
        throw new Error('database unavailable')
      }
      events.push(`end-${payload.gr_number}`)
    })

    const result = await saveGRRecordBatch(
      [student('42'), student('43'), student('44')],
      options({ insertOne })
    )

    expect(maximumActive).toBe(1)
    expect(events).toEqual([
      'start-42',
      'end-42',
      'start-43',
      'fail-43',
      'start-44',
      'end-44',
    ])
    expect(result.rows.map((row) => row.status)).toEqual(['saved', 'failed', 'saved'])
    expect(result.savedCount).toBe(2)
    expect(result.failedCount).toBe(1)
  })

  it('maps a race-time unique violation to skipped and continues', async () => {
    const insertOne = vi.fn(async (payload: GRRecordInsertPayload) => {
      if (payload.gr_number === '42') {
        throw { code: '23505', message: 'unique constraint violation' }
      }
    })

    const result = await saveGRRecordBatch(
      [student('42'), student('43')],
      options({ insertOne })
    )

    expect(insertOne).toHaveBeenCalledTimes(2)
    expect(result.rows.map((row) => [row.status, row.reason])).toEqual([
      ['skipped', 'already-exists'],
      ['saved', null],
    ])
    expect(result.skippedCount).toBe(1)
    expect(result.savedCount).toBe(1)
  })

  it('does not insert unchecked rows when the single preflight fails', async () => {
    const insertOne = vi.fn(async () => undefined)
    const result = await saveGRRecordBatch(
      [student('42'), student('43')],
      options({
        findExisting: async () => { throw new Error('lookup failed') },
        insertOne,
      })
    )

    expect(insertOne).not.toHaveBeenCalled()
    expect(result.rows.map((row) => [row.status, row.reason])).toEqual([
      ['failed', 'preflight-error'],
      ['failed', 'preflight-error'],
    ])
    expect(result.failedCount).toBe(2)
  })
})
