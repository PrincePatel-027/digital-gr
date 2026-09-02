'use client'

import { useMemo, useState } from 'react'
import {
  type GRRecordBatchRow,
  type GRRecordBatchRowStatus,
} from '@/lib/gr-record-batch'
import {
  GR_RECORD_FIELD_LABELS,
  GR_RECORD_FIELD_ORDER,
  GR_RECORD_REQUIRED_FIELDS,
  type GRRecordField,
} from '@/lib/gr-record-data'
import {
  formatGujaratLocationLabel,
  getGujaratSubdistricts,
  GUJARAT_DISTRICTS,
} from '@/lib/gujarat-locations'
import type { ParsedField } from '@/lib/ocr-parser'
import {
  coerceVoiceBilingualFields,
  requiredAiGujaratiNameFields,
  updateVoiceField,
} from '@/lib/voice-bilingual'
import { prepareVoiceGRRecordBatch } from '@/lib/voice-persistence'
import type {
  VoiceFieldSource,
  VoiceReviewFields,
  VoiceScript,
} from '@/lib/voice-types'

interface VoiceBatchReviewProps {
  records: readonly VoiceReviewFields[]
  outcomes?: readonly GRRecordBatchRow[]
  disabled?: boolean
  saving?: boolean
  onChange: (records: VoiceReviewFields[]) => void
  onSave?: () => void
  onDiscardAll?: () => void
}

const DATE_FIELDS = new Set<GRRecordField>([
  'date_of_birth',
  'admission_date',
  'leaving_date',
])
const TEXTAREA_FIELDS = new Set<GRRecordField>([
  'address',
  'progress_and_conduct',
  'leaving_reason',
  'remarks',
])
const REQUIRED_FIELDS = new Set<GRRecordField>(GR_RECORD_REQUIRED_FIELDS)

const STATUS_STYLES: Record<GRRecordBatchRowStatus, string> = {
  ready: 'border-accent/30 bg-accent/[0.07] text-accent',
  invalid: 'border-warning/35 bg-warning/[0.08] text-warning',
  saved: 'border-success/35 bg-success/[0.08] text-success',
  skipped: 'border-line-strong bg-surface-2 text-ink-soft',
  failed: 'border-error/35 bg-error/[0.07] text-error',
}

const STATUS_LABELS: Record<GRRecordBatchRowStatus, string> = {
  ready: 'Ready for review',
  invalid: 'Missing required fields',
  saved: 'Saved',
  skipped: 'Skipped',
  failed: 'Save failed',
}

const SOURCE_LABELS: Record<VoiceFieldSource, string> = {
  ai: 'AI',
  'canonical-lgd': 'LGD',
  shared: 'Shared',
  clerk: 'Edited',
  'single-script': 'Single script',
}

function confidenceClass(confidence?: ParsedField['confidence']): string {
  if (confidence === 'high') return 'bg-success'
  if (confidence === 'medium') return 'bg-warning'
  return 'bg-error'
}

function splitLabel(field: GRRecordField): [string, string] {
  const label = GR_RECORD_FIELD_LABELS[field]
  const separator = label.indexOf(' / ')
  return separator === -1
    ? [label, '']
    : [label.slice(0, separator), label.slice(separator + 3)]
}

function statusIcon(status: GRRecordBatchRowStatus) {
  if (status === 'saved') {
    return <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  }
  if (status === 'failed' || status === 'invalid') {
    return <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.2 14.2A2 2 0 003.82 21h16.36a2 2 0 001.73-2.94l-8.2-14.2a2 2 0 00-3.46 0z" />
  }
  if (status === 'skipped') {
    return <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
  }
  return <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
}

function reviewKey(index: number, field: GRRecordField): string {
  return `${index}:${field}`
}

export default function VoiceBatchReview({
  records,
  outcomes,
  disabled = false,
  saving = false,
  onChange,
  onSave,
  onDiscardAll,
}: VoiceBatchReviewProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set([0]))
  const [script, setScript] = useState<VoiceScript>('en')
  const [viewedGujaratiFields, setViewedGujaratiFields] = useState<Set<string>>(new Set())
  const [reviewAttempted, setReviewAttempted] = useState(false)
  const dualRecords = useMemo(
    () => records.map((record) => coerceVoiceBilingualFields(record)),
    [records]
  )
  const preparedRows = useMemo(() => prepareVoiceGRRecordBatch(records), [records])
  const outcomeByIndex = useMemo(
    () => new Map((outcomes ?? []).map((row) => [row.index, row])),
    [outcomes]
  )
  const displayRows = preparedRows.map((row) => outcomeByIndex.get(row.index) ?? row)
  const readyCount = displayRows.filter((row) => row.status === 'ready').length
  const terminalCount = preparedRows.filter((row) => outcomeByIndex.has(row.index)).length
  const requiredAiFields = dualRecords.flatMap((record, index) => (
    requiredAiGujaratiNameFields(record).map((field) => ({ index, field }))
  ))
  const unviewedAiFields = requiredAiFields.filter(
    ({ index, field }) => !viewedGujaratiFields.has(reviewKey(index, field))
  )
  const reviewBlocked = unviewedAiFields.length > 0

  function markRowsViewed(indices: Iterable<number>) {
    setViewedGujaratiFields((previous) => {
      const next = new Set(previous)
      for (const index of indices) {
        const record = dualRecords[index]
        if (!record) continue
        for (const field of requiredAiGujaratiNameFields(record)) {
          next.add(reviewKey(index, field))
        }
      }
      return next
    })
  }

  function selectScript(nextScript: VoiceScript) {
    if (nextScript === 'gu') markRowsViewed(expandedRows)
    setScript(nextScript)
    setReviewAttempted(false)
  }

  function toggleRow(index: number) {
    const opening = !expandedRows.has(index)
    setExpandedRows((previous) => {
      const next = new Set(previous)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    if (opening && script === 'gu') markRowsViewed([index])
  }

  function updateField(index: number, field: GRRecordField, value: string) {
    const nextRecords = records.map((record, recordIndex) => (
      recordIndex === index
        ? updateVoiceField(coerceVoiceBilingualFields(record), script, field, value)
        : record
    ))
    setReviewAttempted(false)
    onChange(nextRecords)
  }

  function discardRow(index: number) {
    onChange(records.filter((_, recordIndex) => recordIndex !== index))
    setViewedGujaratiFields(new Set())
    setReviewAttempted(false)
    setExpandedRows((previous) => {
      const next = new Set<number>()
      for (const openIndex of previous) {
        if (openIndex < index) next.add(openIndex)
        else if (openIndex > index) next.add(openIndex - 1)
      }
      if (next.size === 0 && records.length > 1) next.add(0)
      return next
    })
  }

  function requestSave() {
    if (reviewBlocked) {
      setReviewAttempted(true)
      return
    }
    onSave?.()
  }

  if (records.length === 0) {
    return (
      <section className="neu-card p-5 text-center" aria-labelledby="batch-review-title">
        <h2 id="batch-review-title" className="text-sm font-semibold text-ink">
          No student rows to review
        </h2>
        <p className="text-xs text-ink-soft mt-1">
          Record another batch or return to single-record entry.
        </p>
      </section>
    )
  }

  return (
    <section className="neu-card overflow-hidden" aria-labelledby="batch-review-title">
      <header className="px-5 sm:px-6 py-4 border-b border-line-strong bg-surface-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 id="batch-review-title" className="font-gujarati-serif text-sm font-semibold text-ink">
              Multiple student records
            </h2>
            <p className="text-xs text-ink-soft mt-1">
              Review and edit every row. Nothing is saved until you choose Save reviewed records.
            </p>
          </div>
          <span className="neu-badge bg-accent/10 text-accent self-start">
            {records.length} row{records.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mt-3 inline-grid grid-cols-2 gap-1" role="group" aria-label="Batch review script">
          <button
            type="button"
            onClick={() => selectScript('en')}
            aria-pressed={script === 'en'}
            className={`neu-btn px-3 py-2 text-xs ${script === 'en' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => selectScript('gu')}
            aria-pressed={script === 'gu'}
            className={`neu-btn px-3 py-2 text-xs ${script === 'gu' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
          >
            ગુજરાતી
          </button>
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {script === 'gu' ? 'Showing Gujarati values for batch review.' : 'Showing English values for batch review.'}
        </p>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {terminalCount > 0
            ? `${terminalCount} of ${records.length} rows have save outcomes.`
            : `${readyCount} of ${records.length} rows are complete.`}
        </p>
      </header>

      <div className="divide-y divide-line">
        {dualRecords.map((record, index) => {
          const row = displayRows[index]
          const visible = record[script]
          const expanded = expandedRows.has(index)
          const panelId = `batch-row-${index}-fields`
          const titleId = `batch-row-${index}-title`
          const terminal = outcomeByIndex.has(row.index)
          const rowDisabled = disabled || saving || terminal

          return (
            <article key={index} aria-labelledby={titleId} className="bg-surface">
              <div className="p-4 sm:px-5 flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleRow(index)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span id={titleId} className={`font-semibold text-sm text-ink ${script === 'gu' ? 'font-gujarati' : ''}`}>
                      {visible.student_name?.value.trim() || `Student row ${index + 1}`}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[row.status]}`}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                        {statusIcon(row.status)}
                      </svg>
                      {STATUS_LABELS[row.status]}
                    </span>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                    <span>GR <span className="text-mono font-medium text-ink">{visible.gr_number?.value || '—'}</span></span>
                    <span>DOB <span className="text-mono font-medium text-ink">{visible.date_of_birth?.value || '—'}</span></span>
                    <span>{expanded ? 'Hide fields' : 'Edit fields'}</span>
                  </span>
                  {row.message && (
                    <span className={`block text-xs mt-2 ${row.status === 'failed' ? 'text-error' : row.status === 'invalid' ? 'text-warning' : 'text-ink-soft'}`}>
                      {row.message}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => discardRow(index)}
                  disabled={rowDisabled}
                  aria-label={`Discard ${visible.student_name?.value.trim() || `student row ${index + 1}`}`}
                  className="neu-btn neu-btn-ghost px-3 py-2 text-xs shrink-0"
                >
                  Discard
                </button>
              </div>

              {expanded && (
                <div id={panelId} className="px-4 sm:px-5 pb-5" aria-label={`Fields for student row ${index + 1}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 border-t border-line pt-4">
                    {GR_RECORD_FIELD_ORDER.map((field) => {
                      const parsed = visible[field]
                      const source = record.sources[field]?.[script]
                      const [gujaratiLabel, englishLabel] = splitLabel(field)
                      const required = REQUIRED_FIELDS.has(field)
                      const hasError = row.missingFields.some((missingField) => missingField === field)
                      const inputId = `batch-${index}-${field}`
                      const errorId = `${inputId}-error`
                      const sharedClass = `neu-input ${field === 'gr_number' || DATE_FIELDS.has(field) ? 'neu-input-mono' : script === 'gu' ? 'font-gujarati' : ''} ${hasError ? 'neu-input-error' : ''}`
                      const locationOptions = field === 'previous_school_district'
                        ? GUJARAT_DISTRICTS
                        : field === 'previous_school_subdistrict'
                          ? getGujaratSubdistricts(visible.previous_school_district?.value)
                          : null
                      const locationDisabled = field === 'previous_school_subdistrict' && locationOptions?.length === 0

                      return (
                        <div key={field} className={TEXTAREA_FIELDS.has(field) ? 'sm:col-span-2' : ''}>
                          <label htmlFor={inputId} className="block mb-1.5">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="label-gu">{gujaratiLabel}</span>
                              {required && <span className="text-error text-sm leading-none" aria-hidden="true">*</span>}
                              {parsed && (
                                <span
                                  className={`w-2 h-2 rounded-full ${confidenceClass(parsed.confidence)}`}
                                  title={`${parsed.confidence} extraction confidence`}
                                  aria-hidden="true"
                                />
                              )}
                              {source && (
                                <span className="neu-badge bg-surface-2 text-ink-soft text-[9px] px-1.5 py-0.5" title={`Value source: ${SOURCE_LABELS[source]}`}>
                                  {SOURCE_LABELS[source]}
                                </span>
                              )}
                              {required && <span className="sr-only">required</span>}
                              {parsed && <span className="sr-only">{parsed.confidence} extraction confidence</span>}
                            </span>
                            <span className="label-en">{englishLabel}</span>
                          </label>
                          {locationOptions ? (
                            <select
                              id={inputId}
                              value={parsed?.value ?? ''}
                              onChange={(event) => updateField(index, field, event.target.value)}
                              disabled={rowDisabled || locationDisabled}
                              aria-invalid={hasError || undefined}
                              aria-describedby={hasError ? errorId : undefined}
                              className={sharedClass}
                            >
                              <option value="">
                                {field === 'previous_school_district'
                                  ? 'Select district'
                                  : locationDisabled ? 'Select district first' : 'Select taluka'}
                              </option>
                              {locationOptions.map((location) => (
                                <option key={location.key} value={location.key}>
                                  {formatGujaratLocationLabel(location.key, script)}
                                </option>
                              ))}
                            </select>
                          ) : TEXTAREA_FIELDS.has(field) ? (
                            <textarea
                              id={inputId}
                              value={parsed?.value ?? ''}
                              onChange={(event) => updateField(index, field, event.target.value)}
                              disabled={rowDisabled}
                              rows={2}
                              aria-invalid={hasError || undefined}
                              aria-describedby={hasError ? errorId : undefined}
                              className={`${sharedClass} resize-y`}
                            />
                          ) : (
                            <input
                              id={inputId}
                              type={DATE_FIELDS.has(field) ? 'date' : 'text'}
                              value={parsed?.value ?? ''}
                              onChange={(event) => updateField(index, field, event.target.value)}
                              disabled={rowDisabled}
                              aria-invalid={hasError || undefined}
                              aria-describedby={hasError ? errorId : undefined}
                              className={sharedClass}
                            />
                          )}
                          {hasError && (
                            <p id={errorId} className="text-xs text-error font-medium mt-1.5">
                              {englishLabel || gujaratiLabel} is required in the Gujarati record.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <footer className="p-4 sm:px-5 border-t border-line-strong bg-surface-2 space-y-3">
        {reviewBlocked && (
          <div
            className="rounded-xl border border-warning/35 bg-warning/[0.08] px-4 py-3"
            role={reviewAttempted ? 'alert' : 'note'}
          >
            <p className="text-xs font-semibold text-warning">Gujarati name review required</p>
            <p className="text-[11px] text-warning/80 mt-1">
              Switch to ગુજરાતી and expand each affected row before saving. {unviewedAiFields.length} AI-sourced required name {unviewedAiFields.length === 1 ? 'value remains' : 'values remain'} to review.
            </p>
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          {onDiscardAll ? (
            <button
              type="button"
              onClick={onDiscardAll}
              disabled={disabled || saving}
              className="neu-btn neu-btn-ghost"
            >
              Discard batch
            </button>
          ) : <span />}
          {onSave && (
            <button
              type="button"
              onClick={requestSave}
              disabled={disabled || saving || readyCount === 0}
              className="neu-btn neu-btn-primary"
            >
              {saving
                ? 'Saving records one by one…'
                : readyCount > 0
                  ? `Save ${readyCount} reviewed record${readyCount === 1 ? '' : 's'}`
                  : 'No complete records to save'}
            </button>
          )}
        </div>
      </footer>
    </section>
  )
}
