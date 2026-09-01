import {
  buildGRRecordPayload,
  EMPTY_GR_RECORD,
  GR_RECORD_FIELD_LABELS,
  GR_RECORD_REQUIRED_FIELDS,
  mergeParsedValues,
  type GRRecordPayload,
  type GRRecordRequiredField,
} from './gr-record-data'
import type { ParsedGRFields } from './ocr-parser'

export type GRRecordBatchRowStatus =
  | 'ready'
  | 'invalid'
  | 'saved'
  | 'skipped'
  | 'failed'

export type GRRecordBatchRowReason =
  | 'missing-required-fields'
  | 'duplicate-in-batch'
  | 'already-exists'
  | 'preflight-error'
  | 'insert-error'
  | null

export interface GRRecordBatchSource {
  imageUrl?: string | null
  ocrRawText?: string | null
}

export interface GRRecordInsertPayload extends GRRecordPayload {
  school_id: string
  created_by: string
}

export interface GRRecordBatchRow {
  index: number
  grNumber: string
  payload: GRRecordPayload
  status: GRRecordBatchRowStatus
  reason: GRRecordBatchRowReason
  missingFields: GRRecordRequiredField[]
  message: string | null
}

export interface GRRecordBatchResult {
  rows: GRRecordBatchRow[]
  savedCount: number
  skippedCount: number
  failedCount: number
  invalidCount: number
}

export interface GRRecordBatchPorts {
  findExisting: (grNumbers: readonly string[]) => Promise<readonly string[]>
  insertOne: (payload: GRRecordInsertPayload) => Promise<void>
}

export interface SaveGRRecordBatchOptions extends GRRecordBatchSource, GRRecordBatchPorts {
  schoolId: string
  createdBy: string
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(error)
}

function hasErrorCode(error: unknown, expectedCode: string): boolean {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === expectedCode
}

function englishFieldLabel(field: GRRecordRequiredField): string {
  const label = GR_RECORD_FIELD_LABELS[field]
  const separator = label.indexOf(' / ')
  return separator === -1 ? label : label.slice(separator + 3)
}

export function getMissingGRRecordFields(
  fields: ParsedGRFields
): GRRecordRequiredField[] {
  return GR_RECORD_REQUIRED_FIELDS.filter((field) => !fields[field]?.value.trim())
}

/**
 * Maps provider-neutral parsed fields to the existing database payload contract.
 * Duplicate GR numbers are determined across the complete batch, and every
 * occurrence is skipped rather than selecting an arbitrary winner.
 */
export function prepareGRRecordBatch(
  records: readonly ParsedGRFields[],
  source: GRRecordBatchSource = {}
): GRRecordBatchRow[] {
  const mapped = records.map((fields, index) => {
    const record = mergeParsedValues({
      ...EMPTY_GR_RECORD,
      image_url: source.imageUrl ?? '',
      ocr_raw_text: source.ocrRawText ?? '',
    }, fields)
    const payload = buildGRRecordPayload(record)
    const missingFields = GR_RECORD_REQUIRED_FIELDS.filter(
      (field) => !record[field].trim()
    )

    return {
      index,
      grNumber: payload.gr_number,
      payload,
      missingFields: [...missingFields],
    }
  })

  const grNumberCounts = new Map<string, number>()
  for (const row of mapped) {
    if (!row.grNumber) continue
    grNumberCounts.set(row.grNumber, (grNumberCounts.get(row.grNumber) ?? 0) + 1)
  }

  return mapped.map((row): GRRecordBatchRow => {
    if (row.grNumber && (grNumberCounts.get(row.grNumber) ?? 0) > 1) {
      return {
        ...row,
        status: 'skipped',
        reason: 'duplicate-in-batch',
        message: `GR ${row.grNumber} appears more than once in this batch. All occurrences were skipped.`,
      }
    }

    if (row.missingFields.length > 0) {
      const missing = row.missingFields.map(englishFieldLabel).join(', ')
      return {
        ...row,
        status: 'invalid',
        reason: 'missing-required-fields',
        message: `Row ${row.index + 1} is missing required fields: ${missing}.`,
      }
    }

    return {
      ...row,
      status: 'ready',
      reason: null,
      message: null,
    }
  })
}

function resultFromRows(rows: GRRecordBatchRow[]): GRRecordBatchResult {
  return {
    rows,
    savedCount: rows.filter((row) => row.status === 'saved').length,
    skippedCount: rows.filter((row) => row.status === 'skipped').length,
    failedCount: rows.filter((row) => row.status === 'failed').length,
    invalidCount: rows.filter((row) => row.status === 'invalid').length,
  }
}

/**
 * Performs one collision preflight, then awaits inserts one by one. An insert
 * failure belongs only to that row; later eligible rows still run.
 */
export async function saveGRRecordBatch(
  records: readonly ParsedGRFields[],
  options: SaveGRRecordBatchOptions
): Promise<GRRecordBatchResult> {
  let rows = prepareGRRecordBatch(records, options)
  const readyGRNumbers = rows
    .filter((row) => row.status === 'ready')
    .map((row) => row.grNumber)

  let existing = new Set<string>()
  if (readyGRNumbers.length > 0) {
    try {
      existing = new Set(
        (await options.findExisting(readyGRNumbers))
          .map((grNumber) => grNumber.trim())
          .filter(Boolean)
      )
    } catch (error) {
      const message = errorMessage(error)
      rows = rows.map((row) => row.status === 'ready'
        ? {
            ...row,
            status: 'failed' as const,
            reason: 'preflight-error' as const,
            message: `Could not check GR ${row.grNumber} for duplicates: ${message}`,
          }
        : row)
      return resultFromRows(rows)
    }
  }

  const completedRows: GRRecordBatchRow[] = []
  for (const row of rows) {
    if (row.status !== 'ready') {
      completedRows.push(row)
      continue
    }

    if (existing.has(row.grNumber)) {
      completedRows.push({
        ...row,
        status: 'skipped',
        reason: 'already-exists',
        message: `GR ${row.grNumber} already exists.`,
      })
      continue
    }

    try {
      await options.insertOne({
        ...row.payload,
        school_id: options.schoolId,
        created_by: options.createdBy,
      })
      completedRows.push({
        ...row,
        status: 'saved',
        reason: null,
        message: `GR ${row.grNumber} saved.`,
      })
    } catch (error) {
      if (hasErrorCode(error, '23505')) {
        completedRows.push({
          ...row,
          status: 'skipped',
          reason: 'already-exists',
          message: `GR ${row.grNumber} already exists.`,
        })
        continue
      }

      completedRows.push({
        ...row,
        status: 'failed',
        reason: 'insert-error',
        message: `GR ${row.grNumber} failed to save: ${errorMessage(error)}`,
      })
    }
  }

  return resultFromRows(completedRows)
}

export function formatGRRecordBatchSummary(result: GRRecordBatchResult): string {
  const counts = [
    `${result.savedCount} saved`,
    result.skippedCount > 0 ? `${result.skippedCount} skipped` : null,
    result.failedCount > 0 ? `${result.failedCount} failed` : null,
    result.invalidCount > 0 ? `${result.invalidCount} invalid` : null,
  ].filter((count): count is string => count !== null)

  const details = [...new Set(result.rows
    .filter((row) => row.status !== 'saved' && row.message)
    .map((row) => row.message!))]

  return `${counts.join(', ')}${details.length > 0 ? `: ${details.join(' ')}` : '.'}`
}
