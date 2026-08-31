'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { parseGRTable, countParsedFields, type ParsedGRFields, type ParsedField } from '@/lib/ocr-parser'
import type {
  ApiErrorResponse,
  GuidedScanResponse,
  OcrMode,
  OcrPipelineResponse,
} from '@/lib/ocr-types'
import {
  buildGRRecordPayload,
  EMPTY_GR_RECORD,
  mergeParsedValues,
  type GRRecordData,
} from '@/lib/gr-record-data'
import { VOICE_FIELD_GROUPS } from '@/lib/voice-fields'
import {
  buildSpokenAuditText,
  mergeVoiceGroups,
  voiceResultsInGroupOrder,
} from '@/lib/voice-merge'
import type { VoiceEntryResponse, VoiceGroupId } from '@/lib/voice-types'
import ImageUploader from '@/components/ImageUploader'
import GuidedRegisterScanner from '@/components/GuidedRegisterScanner'
import VoiceEntryRecorder from '@/components/VoiceEntryRecorder'

export type { GRRecordData } from '@/lib/gr-record-data'

// ── Types ─────────────────────────────────────────────────────
interface GRRecordFormProps {
  mode: 'create' | 'edit'
  initialData?: Partial<GRRecordData>
}

const EMPTY_FORM = EMPTY_GR_RECORD

const REQUIRED_FIELDS: (keyof GRRecordData)[] = [
  'gr_number', 'student_name', 'fathers_name', 'surname', 'date_of_birth', 'admission_date',
]

const FIELD_LABELS: Record<string, string> = {
  // Left page
  gr_number: 'રજિસ્ટર નંબર / GR Number',
  student_name: 'વિદ્યાર્થીનું નામ / Student Name',
  fathers_name: 'પિતાનું નામ / Father\'s Name',
  mothers_name: 'માતાનું નામ / Mother\'s Name',
  surname: 'અટક / Surname',
  religion: 'ધર્મ / Religion',
  caste_category: 'જ્ઞાતિ / Caste',
  date_of_birth: 'જન્મ તારીખ (અંકમાં) / DOB',
  dob_in_words: 'જન્મ તારીખ (શબ્દોમાં) / DOB in Words',
  birth_place: 'જન્મ સ્થળ / Birth Place',
  address: 'ગામ / Village',
  previous_school: 'છેલ્લી શાળા / Previous School',
  // Right page
  admission_date: 'દાખલ થયા તારીખ / Admission Date',
  admission_standard: 'દાખલ થયા ધોરણ / Admission Std.',
  progress_and_conduct: 'પ્રગતિ અને વર્તન / Progress & Conduct',
  leaving_date: 'શાળા છોડ્યા તારીખ / Leaving Date',
  leaving_reason: 'છોડવાનું કારણ / Reason for Leaving',
  leaving_standard: 'છોડતી વખતે ધોરણ / Leaving Std.',
  remarks: 'રીમાર્ક્સ / શેરો / Remarks',
}

const PARSEABLE_FIELDS: (keyof ParsedGRFields)[] = [
  'gr_number', 'student_name', 'fathers_name', 'mothers_name',
  'surname', 'religion', 'caste_category', 'date_of_birth',
  'dob_in_words', 'birth_place', 'address', 'previous_school',
  'admission_date', 'admission_standard', 'progress_and_conduct',
  'leaving_date', 'leaving_reason', 'leaving_standard', 'remarks',
]

// Dot colour by extraction confidence
function confidenceClass(confidence?: ParsedField['confidence']) {
  if (confidence === 'high') return 'bg-success'
  if (confidence === 'medium') return 'bg-warning'
  return 'bg-error'
}

// ── Component ─────────────────────────────────────────────────
export default function GRRecordForm({ mode, initialData }: GRRecordFormProps) {
  const router = useRouter()
  const { profile, session } = useAuth()
  const ocrRequestIdRef = useRef(0)
  const voiceSessionRequestIdRef = useRef(0)
  const voiceResultsRef = useRef<Partial<Record<VoiceGroupId, VoiceEntryResponse>>>({})
  const autoFilledFieldsRef = useRef<Set<keyof ParsedGRFields>>(new Set())

  const [form, setForm] = useState<GRRecordData>({ ...EMPTY_FORM, ...initialData })
  const [errors, setErrors] = useState<Partial<Record<keyof GRRecordData, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [ocrText, setOcrText] = useState<string>(initialData?.ocr_raw_text || '')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [captureBusy, setCaptureBusy] = useState(false)
  const [ocrMode, setOcrMode] = useState<OcrMode | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [captureMode, setCaptureMode] = useState<'single' | 'guided' | 'voice'>('single')
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([])

  // Multi-record support
  const [parsedRecords, setParsedRecords] = useState<ParsedGRFields[]>([])
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null)
  const [autoFilledFields, setAutoFilledFields] = useState<Set<keyof ParsedGRFields>>(new Set())
  const [showRawText, setShowRawText] = useState(false)

  const applyParsedRecord = useCallback((
    parsed: ParsedGRFields,
    preserve?: Pick<GRRecordData, 'image_url' | 'ocr_raw_text'>,
    options?: { merge?: boolean }
  ) => {
    const filledKeys = new Set<keyof ParsedGRFields>()
    for (const field of PARSEABLE_FIELDS) {
      if (parsed[field]?.value) filledKeys.add(field)
    }

    setForm((previous) => {
      const base = options?.merge
        ? previous
        : {
            ...EMPTY_FORM,
            image_url: preserve?.image_url ?? previous.image_url,
            ocr_raw_text: preserve?.ocr_raw_text ?? previous.ocr_raw_text,
          }
      const merged = mergeParsedValues(base, parsed)
      return {
        ...merged,
        image_url: preserve?.image_url ?? merged.image_url,
        ocr_raw_text: preserve?.ocr_raw_text ?? merged.ocr_raw_text,
      }
    })

    setAutoFilledFields((previous) => {
      const next = options?.merge ? new Set(previous) : new Set<keyof ParsedGRFields>()
      filledKeys.forEach((field) => next.add(field))
      autoFilledFieldsRef.current = next
      return next
    })
    if (options?.merge) {
      setErrors((previous) => {
        const next = { ...previous }
        filledKeys.forEach((field) => delete next[field])
        return next
      })
    } else {
      setErrors({})
    }
  }, [])

  function updateField(field: keyof GRRecordData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => { const next = { ...prev }; delete next[field]; return next })
    }
    if (autoFilledFieldsRef.current.has(field as keyof ParsedGRFields)) {
      setAutoFilledFields((previous) => {
        const next = new Set(previous)
        next.delete(field as keyof ParsedGRFields)
        autoFilledFieldsRef.current = next
        return next
      })
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof GRRecordData, string>> = {}
    for (const field of REQUIRED_FIELDS) {
      if (!form[field]?.trim()) newErrors[field] = `${FIELD_LABELS[field].split(' /')[0]} is required`
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function beginOcrSource(storagePath = ''): number {
    const requestId = ++ocrRequestIdRef.current
    voiceResultsRef.current = {}
    setForm({ ...EMPTY_FORM, image_url: storagePath })
    setErrors({})
    setSaveError(null)
    setOcrText('')
    setOcrLoading(false)
    setCaptureBusy(false)
    setOcrMode(null)
    setOcrError(null)
    setExtractionWarnings([])
    setParsedRecords([])
    setSelectedRecordIndex(null)
    autoFilledFieldsRef.current = new Set()
    setAutoFilledFields(new Set())
    setShowRawText(false)
    return requestId
  }

  function applyOcrResult(result: OcrPipelineResponse, storagePath: string) {
    const rawText = result.text?.trim() || ''
    const hasUsableText = rawText.length > 0 && rawText !== '(No text detected in image)'
    const preserved = {
      image_url: storagePath,
      ocr_raw_text: hasUsableText ? rawText : '',
    }

    setForm((previous) => ({ ...previous, ...preserved }))
    setOcrText(rawText)
    setOcrMode(result.mode)

    if ('records' in result && Array.isArray(result.records) && result.records.length > 0) {
      const records = result.records
      setParsedRecords(records)
      if (records.length === 1) {
        applyParsedRecord(records[0], preserved)
        setSelectedRecordIndex(0)
      }
      return
    }

    if (hasUsableText) {
      const tableRecords = parseGRTable(rawText)
      setParsedRecords(tableRecords)
      if (tableRecords.length === 1) {
        applyParsedRecord(tableRecords[0], preserved)
        setSelectedRecordIndex(0)
      }
      return
    }

    setOcrError(result.error || 'Couldn\'t read the register page automatically. Please fill in the fields manually.')
  }

  async function handleImageUpload(storagePath: string) {
    const requestId = beginOcrSource(storagePath)
    setOcrLoading(true)

    try {
      if (!session?.access_token) throw new Error('Your session has expired. Sign in again before extracting text.')

      const { data: fileData, error: dlError } = await supabase.storage.from('gr-images').download(storagePath)
      if (dlError || !fileData) {
        throw new Error('Couldn\'t read the uploaded image for text extraction.')
      }

      if (fileData.size > 4 * 1024 * 1024 + 256 * 1024) {
        throw new Error('The image is too large to process. Choose a file up to 4.25 MB.')
      }

      const formData = new FormData()
      formData.append('image', fileData, 'scan.jpg')
      const response = await fetch('/api/ocr-test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      // Vercel can reject an oversized request or time out before the route returns
      // JSON. Decode defensively so the user sees the real HTTP failure instead of a
      // misleading "not valid JSON" browser error.
      const result: unknown = await response.json().catch(() => null)
      const apiError =
        result !== null &&
        typeof result === 'object' &&
        'error' in result &&
        typeof (result as ApiErrorResponse).error === 'string'
          ? (result as ApiErrorResponse).error
          : null
      if (!response.ok) {
        const fallbackMessage = response.status === 413
          ? 'The image is too large to process. Choose a file up to 4.25 MB.'
          : response.status === 504
            ? 'Processing timed out on the server. Try again with a clearer image.'
            : `Text extraction failed (HTTP ${response.status}).`
        throw new Error(apiError || fallbackMessage)
      }
      if (
        result === null ||
        typeof result !== 'object' ||
        !('mode' in result) ||
        !('text' in result)
      ) {
        throw new Error('Text extraction returned an unreadable response. Please try again.')
      }
      if (requestId !== ocrRequestIdRef.current) return

      applyOcrResult(result as OcrPipelineResponse, storagePath)
    } catch (error) {
      if (requestId !== ocrRequestIdRef.current) return
      console.error('OCR error:', error)
      setOcrError(error instanceof Error ? error.message : 'Text extraction failed. Fill in fields manually.')
    } finally {
      if (requestId === ocrRequestIdRef.current) setOcrLoading(false)
    }
  }

  function handleGuidedProcessingChange(processing: boolean) {
    if (processing) beginOcrSource()
    setCaptureBusy(processing)
  }

  function handleGuidedScanComplete(result: GuidedScanResponse) {
    setExtractionWarnings(result.scan.warnings)
    applyOcrResult(result, result.scan.storagePath)
  }

  function selectCaptureMode(nextMode: 'single' | 'guided' | 'voice') {
    if (nextMode === captureMode) return
    const requestId = beginOcrSource()
    voiceSessionRequestIdRef.current = nextMode === 'voice' ? requestId : 0
    setCaptureMode(nextMode)
  }

  function ensureVoiceSession() {
    if (
      voiceSessionRequestIdRef.current > 0 &&
      voiceSessionRequestIdRef.current === ocrRequestIdRef.current
    ) return
    voiceSessionRequestIdRef.current = beginOcrSource()
  }

  function syncVoiceAggregate(
    nextResults: Partial<Record<VoiceGroupId, VoiceEntryResponse>>
  ) {
    const ordered = voiceResultsInGroupOrder(nextResults)
    const merged = mergeVoiceGroups(ordered)
    const auditText = buildSpokenAuditText(nextResults)
    const warnings = ordered.flatMap((result) => result.warning ? [result.warning] : [])
    const hasFields = Object.keys(merged.fields).length > 0

    setForm((previous) => ({ ...previous, image_url: '', ocr_raw_text: auditText }))
    setOcrText(auditText)
    setOcrMode(ordered.length > 0 ? 'gemini' : null)
    setOcrError(null)
    setExtractionWarnings(warnings)
    setParsedRecords(hasFields ? [merged.fields] : [])
    setSelectedRecordIndex(hasFields ? 0 : null)
    return { auditText, merged: merged.fields }
  }

  function handleVoiceGroupComplete(result: VoiceEntryResponse) {
    if (
      captureMode !== 'voice' ||
      voiceSessionRequestIdRef.current !== ocrRequestIdRef.current
    ) return

    const nextResults = { ...voiceResultsRef.current, [result.group]: result }
    voiceResultsRef.current = nextResults
    const { auditText } = syncVoiceAggregate(nextResults)
    applyParsedRecord(
      result.fields,
      { image_url: '', ocr_raw_text: auditText },
      { merge: true }
    )
  }

  function handleVoiceGroupClear(group: VoiceGroupId) {
    if (
      captureMode !== 'voice' ||
      voiceSessionRequestIdRef.current !== ocrRequestIdRef.current
    ) return

    const nextResults = { ...voiceResultsRef.current }
    delete nextResults[group]
    voiceResultsRef.current = nextResults

    const scope = VOICE_FIELD_GROUPS[group].fields
    const fieldsToClear = scope.filter((field) => autoFilledFieldsRef.current.has(field))
    if (fieldsToClear.length > 0) {
      setForm((previous) => {
        const next = { ...previous }
        fieldsToClear.forEach((field) => { next[field] = '' })
        return next
      })
      setAutoFilledFields((previous) => {
        const next = new Set(previous)
        scope.forEach((field) => next.delete(field))
        autoFilledFieldsRef.current = next
        return next
      })
    }
    syncVoiceAggregate(nextResults)
  }

  function resetVoiceSession() {
    voiceSessionRequestIdRef.current = beginOcrSource()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    if (ocrLoading || captureBusy) {
      setSaveError('Wait for the current capture to finish before saving.')
      return
    }
    if (parsedRecords.length > 1 && selectedRecordIndex === null) {
      setSaveError('Select the student record that belongs to this entry before saving.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!validate()) {
      // Scroll to top to see errors easily
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!profile) { setSaveError('You must be logged in.'); return }

    setSaving(true)
    try {
      const payload = buildGRRecordPayload(form)

      if (mode === 'create') {
        const { error } = await supabase.from('gr_records').insert({
          ...payload,
          school_id: profile.school_id,
          created_by: profile.id,
        })
        if (error) throw error
      } else {
        if (!initialData?.id) throw new Error('Record ID missing')
        const { error } = await supabase.from('gr_records').update(payload).eq('id', initialData.id)
        if (error) throw error
      }
      router.push('/dashboard/records')
    } catch (err) {
      setSaveError(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Render helpers ──────────────────────────────────────
  const selectedParsedFields = selectedRecordIndex !== null ? parsedRecords[selectedRecordIndex] : null
  const parsedCount = selectedParsedFields ? countParsedFields(selectedParsedFields) : { total: 0 }
  const scanBusy = ocrLoading || captureBusy
  const needsRecordSelection = parsedRecords.length > 1 && selectedRecordIndex === null

  function renderInput(
    field: keyof GRRecordData,
    type: string = 'text',
    opts?: { placeholder?: string; rows?: number }
  ) {
    const isRequired = REQUIRED_FIELDS.includes(field)
    const hasError = !!errors[field]
    const isAutoFilled = autoFilledFields.has(field as keyof ParsedGRFields)
    const parsed = selectedParsedFields ? selectedParsedFields[field as keyof ParsedGRFields] : null

    // Labels are stored as "ગુજરાતી / English" — split so Gujarati leads, the way
    // the caption is printed on the page, with English as the quiet sub-caption.
    const [guLabel, enLabel] = (() => {
      const raw = FIELD_LABELS[field] || field
      const idx = raw.indexOf(' / ')
      return idx === -1 ? [raw, ''] : [raw.slice(0, idx), raw.slice(idx + 3)]
    })()

    // GR numbers and dates are ledger figures — set them in tabular mono.
    const monoField = field === 'gr_number' || type === 'date'

    return (
      <div>
        <label htmlFor={`field-${field}`} className="block mb-1.5">
          <span className="flex items-center gap-1.5">
            <span className="label-gu">{guLabel}</span>
            {isRequired && <span className="text-error text-sm leading-none">*</span>}
            {isAutoFilled && parsed && (
              <span
                className={`w-2 h-2 rounded-full ${confidenceClass(parsed.confidence)}`}
                title={`${captureMode === 'voice' ? 'Filled from voice' : 'Read from the scan'} — ${parsed.confidence} confidence`}
              />
            )}
          </span>
          <span className="label-en">{enLabel}</span>
        </label>
        {type === 'textarea' ? (
          <textarea
            id={`field-${field}`}
            value={form[field]}
            onChange={(e) => updateField(field, e.target.value)}
            rows={opts?.rows || 3}
            placeholder={opts?.placeholder}
            className={`neu-input resize-none font-gujarati ${hasError ? 'neu-input-error' : ''} ${isAutoFilled ? 'border-accent/60' : ''}`}
          />
        ) : (
          <input
            id={`field-${field}`}
            type={type}
            value={form[field]}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={opts?.placeholder}
            className={`neu-input ${monoField ? 'neu-input-mono' : 'font-gujarati'} ${hasError ? 'neu-input-error' : ''} ${isAutoFilled ? 'border-accent/60' : ''}`}
          />
        )}
        {hasError && <p className="text-xs text-error font-medium mt-1.5">{errors[field]}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Upload + OCR */}
      {mode === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Upload */}
          <div className="neu-card overflow-hidden">
            <header className="px-5 py-3 border-b border-line-strong bg-surface-2">
              <h2 className="font-gujarati-serif text-sm font-semibold">
                <span className="text-accent">૧ · </span>વિગતો મેળવો
              </h2>
              <p className="label-en">Scan a register page or dictate a new admission</p>
            </header>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Entry method">
                <button
                  type="button"
                  onClick={() => selectCaptureMode('single')}
                  disabled={scanBusy || saving}
                  aria-pressed={captureMode === 'single'}
                  className={`neu-btn text-xs ${captureMode === 'single' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
                >
                  Single photo
                </button>
                <button
                  type="button"
                  onClick={() => selectCaptureMode('guided')}
                  disabled={scanBusy || saving}
                  aria-pressed={captureMode === 'guided'}
                  className={`neu-btn text-xs ${captureMode === 'guided' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
                >
                  Guided scan
                </button>
                <button
                  type="button"
                  onClick={() => selectCaptureMode('voice')}
                  disabled={scanBusy || saving}
                  aria-pressed={captureMode === 'voice'}
                  className={`neu-btn text-xs ${captureMode === 'voice' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
                >
                  Voice entry
                </button>
              </div>

              {captureMode === 'single' ? (
                <ImageUploader
                  onUpload={handleImageUpload}
                  onBusyChange={setCaptureBusy}
                  disabled={scanBusy || saving}
                />
              ) : captureMode === 'guided' ? (
                <GuidedRegisterScanner
                  onComplete={handleGuidedScanComplete}
                  onProcessingChange={handleGuidedProcessingChange}
                  disabled={saving || scanBusy}
                />
              ) : (
                <VoiceEntryRecorder
                  disabled={saving}
                  onGroupComplete={handleVoiceGroupComplete}
                  onGroupClear={handleVoiceGroupClear}
                  onProcessingChange={setCaptureBusy}
                  onSessionStart={ensureVoiceSession}
                  onReset={resetVoiceSession}
                />
              )}
            </div>
          </div>

          {/* Scan Results */}
          <div className="neu-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-gujarati-serif text-sm font-semibold">વાંચેલી વિગતો</h2>
              {ocrMode && (
                <span className={`neu-badge ${ocrMode === 'mock' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                  {ocrMode === 'gemini'
                    ? captureMode === 'voice' ? 'Gemini audio' : 'Gemini vision'
                    : ocrMode === 'openai'
                      ? 'OpenAI vision'
                      : ocrMode === 'mistral'
                        ? 'Mistral vision'
                        : ocrMode === 'sarvam'
                          ? 'Sarvam AI'
                          : ocrMode === 'mock'
                            ? 'Sample data'
                            : 'OCR text'}
                </span>
              )}
            </div>

            {extractionWarnings.length > 0 && (
              <div className="rounded-xl bg-warning/[0.08] border border-warning/25 px-4 py-3">
                <p className="text-xs font-semibold text-warning">
                  {captureMode === 'voice' ? 'Some dictated fields need extra review' : 'Some scan blocks may need extra review'}
                </p>
                <ul className="text-[11px] text-warning/80 mt-1 space-y-0.5">
                  {extractionWarnings.slice(0, 4).map((warning) => <li key={warning}>• {warning}</li>)}
                </ul>
              </div>
            )}

            {scanBusy ? (
              <div className="flex flex-col items-center gap-3 py-10 text-ink-soft">
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-medium">
                  {captureMode === 'voice' ? 'Recording or processing voice…' : 'Reading the page…'}
                </span>
              </div>
            ) : parsedRecords.length > 0 ? (
              <>
                <div className="rounded-xl bg-success/[0.08] border border-success/25 px-4 py-3 mb-3">
                  <p className="text-sm font-semibold text-success">
                    {captureMode === 'voice'
                      ? `${parsedCount.total} dictated field${parsedCount.total === 1 ? '' : 's'} ready for review`
                      : `${parsedRecords.length} student record${parsedRecords.length !== 1 ? 's' : ''} found`}
                  </p>
                  <p className="text-xs text-success/80 mt-0.5">
                    {captureMode === 'voice'
                      ? 'Nothing is saved automatically. Confirm every field below.'
                      : parsedRecords.length > 1
                        ? 'Select a student below to populate the form.'
                        : 'Review the extracted fields below.'}
                  </p>
                </div>

                {/* Multiple Students Selection UI */}
                {parsedRecords.length > 1 && (
                  <div className="flex flex-col gap-2 mb-4 max-h-[200px] overflow-y-auto pr-1">
                    {parsedRecords.map((rec, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          applyParsedRecord(rec)
                          setSelectedRecordIndex(idx)
                        }}
                        className={`text-left p-3 rounded-xl border transition-colors ${
                          selectedRecordIndex === idx
                            ? 'border-success bg-success/[0.08]'
                            : 'border-line hover:border-ink bg-surface'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm text-ink truncate pr-2">
                            {rec.student_name?.value || '(Unknown name)'}
                          </span>
                          {selectedRecordIndex === idx && (
                            <span className="text-success shrink-0">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink-soft mt-1 flex gap-3">
                          <span>GR: <span className="font-medium text-mono">{rec.gr_number?.value || '-'}</span></span>
                          <span>DOB: <span className="font-medium text-mono">{rec.date_of_birth?.value || '-'}</span></span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Student Fields Overview */}
                {selectedParsedFields && (
                  <div className={parsedRecords.length > 1 ? 'mt-4 pt-4 border-t border-line' : ''}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-ink-faint">Extracted fields</span>
                      <span className="text-[11px] text-ink-faint text-mono">{parsedCount.total} filled</span>
                    </div>
                    <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                      {PARSEABLE_FIELDS.map((field) => {
                        const p = selectedParsedFields[field]
                        if (!p) return null
                        return (
                          <div key={field} className="flex items-start gap-2 text-sm">
                            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${confidenceClass(p.confidence)}`} />
                            <span className="text-ink-faint text-xs font-medium min-w-[80px]">{FIELD_LABELS[field].split(' /')[0]}</span>
                            <span className="text-ink text-xs font-medium">{p.value}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowRawText(!showRawText)}
                  className="mt-3 text-xs text-ink-faint hover:text-ink-soft font-medium transition-colors flex items-center gap-1"
                >
                  <svg className={`w-3 h-3 transition-transform ${showRawText ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {showRawText ? 'Hide' : 'Show'} {captureMode === 'voice' ? 'audit transcript' : 'raw text'}
                </button>
                {showRawText && (
                  <pre className="whitespace-pre-wrap text-xs text-ink-soft bg-surface-2 rounded-xl p-3 mt-2 max-h-[200px] overflow-y-auto text-mono">{ocrText}</pre>
                )}
              </>
            ) : ocrText && parsedRecords.length === 0 ? (
              <>
                <div className="rounded-xl bg-warning/[0.08] border border-warning/25 px-4 py-3">
                  <p className="text-sm font-semibold text-warning">Text detected, but no student records identified</p>
                  <p className="text-xs text-warning/80 mt-0.5">Fill in the fields manually using the text below.</p>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-ink-soft bg-surface-2 rounded-xl p-3 max-h-[250px] overflow-y-auto text-mono">{ocrText}</pre>
              </>
            ) : ocrError ? (
              <div className="rounded-xl bg-warning/[0.08] border border-warning/25 px-4 py-3">
                <p className="text-sm font-medium text-warning">{ocrError}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-ink-faint gap-2">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                <span className="text-xs font-medium">
                  {captureMode === 'voice' ? 'Record a group to fill fields' : 'Upload a page to auto-detect fields'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit mode image */}
      {mode === 'edit' && form.image_url && (
        <div className="neu-card p-5 sm:p-6">
          <h2 className="text-xs font-semibold text-ink-soft mb-3">Scanned image</h2>
          <ImagePreview storagePath={form.image_url} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SECTION 1: મુખ્ય વિગતો — Primary Details (Left Page)
          ═══════════════════════════════════════════════════════ */}
      <div className="neu-card overflow-hidden">
        <header className="px-5 sm:px-6 py-3 border-b border-line-strong bg-surface-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-gujarati-serif text-sm font-semibold">
              {mode === 'create' && <span className="text-accent">૨ · </span>}
              પત્રક ૪ — મુખ્ય વિગતો
            </h2>
            <p className="label-en">Left page · personal details</p>
          </div>
          {autoFilledFields.size > 0 && (
            <span className="neu-badge bg-accent/10 text-accent shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              {autoFilledFields.size} {captureMode === 'voice' ? 'filled by voice' : 'filled from the scan'}
            </span>
          )}
        </header>

        <div className="p-5 sm:p-6 space-y-5">
        {saveError && (
          <div className="neu-card-flat p-4" style={{ borderColor: '#a8322b' }}>
            <p className="text-sm font-semibold text-error">Couldn&apos;t save this entry</p>
            <p className="text-xs text-ink-soft mt-1">{saveError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {renderInput('gr_number', 'text', { placeholder: 'e.g. 1247' })}
          {renderInput('student_name', 'text', { placeholder: 'વિદ્યાર્થીનું પૂરું નામ' })}
          {renderInput('fathers_name', 'text', { placeholder: 'પિતાનું પૂરું નામ' })}
          {renderInput('mothers_name', 'text', { placeholder: 'માતાનું નામ (optional)' })}
          {renderInput('surname', 'text', { placeholder: 'અટક / Family surname' })}
          {renderInput('religion', 'text', { placeholder: 'e.g. હિંદુ, મુસ્લિમ, ખ્રિસ્તી' })}
          {renderInput('caste_category', 'text', { placeholder: 'e.g. રાજપૂત, પટેલ, OBC, SC, ST' })}
          {renderInput('date_of_birth', 'date')}
          {renderInput('dob_in_words', 'text', { placeholder: 'e.g. તા. એક ઓગસ્ટ ઓગણીસો બત્રીસ' })}
          {renderInput('birth_place', 'text', { placeholder: 'જન્મ સ્થળ / Place of birth' })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {renderInput('address', 'textarea', { placeholder: 'ગામ / વતન / રહેઠાણ', rows: 2 })}
          {renderInput('previous_school', 'text', { placeholder: 'છેલ્લી શાળાનું નામ (optional)' })}
        </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2: શૈક્ષણિક વિગતો — Academic Details (Right Page)
          ═══════════════════════════════════════════════════════ */}
      <div className="neu-card overflow-hidden">
        <header className="px-5 sm:px-6 py-3 border-b border-line-strong bg-surface-2">
          <h2 className="font-gujarati-serif text-sm font-semibold">
            {mode === 'create' && <span className="text-accent">૩ · </span>}
            પત્રક ૫ — શૈક્ષણિક વિગતો
          </h2>
          <p className="label-en">Right page · schooling &amp; leaving</p>
        </header>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {renderInput('admission_date', 'date')}
            {renderInput('admission_standard', 'text', { placeholder: 'e.g. 1, 2, 3…' })}
            {renderInput('leaving_date', 'date')}
            {renderInput('leaving_standard', 'text', { placeholder: 'છોડતી વખતે ધોરણ' })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {renderInput('progress_and_conduct', 'textarea', { placeholder: 'પ્રગતિ અને વર્તનની નોંધ', rows: 2 })}
            {renderInput('leaving_reason', 'textarea', { placeholder: 'e.g. અન્ય ગામ જવાને લીધે, અભ્યાસ પૂર્ણ', rows: 2 })}
          </div>

          <div className="grid grid-cols-1 gap-y-4">
            {renderInput('remarks', 'textarea', { placeholder: 'રીમાર્ક્સ / શેરો / અન્ય નોંધ', rows: 3 })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="neu-card p-5 sm:p-6">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="neu-btn neu-btn-ghost w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            id="form-submit"
            type="submit"
            disabled={saving || scanBusy || needsRecordSelection}
            className="neu-btn neu-btn-primary w-full sm:w-auto"
          >
            {saving
              ? 'Saving…'
              : scanBusy
                ? 'Wait for capture…'
                : needsRecordSelection
                  ? 'Select a student first'
                  : mode === 'create'
                    ? 'Save record'
                    : 'Update record'}
          </button>
        </div>
      </div>
    </form>
  )
}

function ImagePreview({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    async function load() {
      const { data } = await supabase.storage.from('gr-images').createSignedUrl(storagePath, 60 * 10)
      if (data?.signedUrl) setUrl(data.signedUrl)
    }
    load()
  }, [storagePath])

  if (!url) return <p className="text-sm text-ink-soft font-medium">Loading image…</p>
  return <img src={url} alt="Scanned register page" className="w-full max-h-64 object-contain rounded-xl bg-surface-2" />
}
