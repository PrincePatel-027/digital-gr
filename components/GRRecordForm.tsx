'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { parseGRFields, countParsedFields, type ParsedGRFields, type ParsedField } from '@/lib/ocr-parser'
import ImageUploader from '@/components/ImageUploader'

// ── Types ─────────────────────────────────────────────────────
export interface GRRecordData {
  id?: string
  gr_number: string
  student_name: string
  fathers_name: string
  mothers_name: string
  surname: string
  date_of_birth: string
  admission_date: string
  address: string
  caste_category: string
  previous_school: string
  image_url: string
  ocr_raw_text: string
}

interface GRRecordFormProps {
  mode: 'create' | 'edit'
  initialData?: Partial<GRRecordData>
}

const EMPTY_FORM: GRRecordData = {
  gr_number: '',
  student_name: '',
  fathers_name: '',
  mothers_name: '',
  surname: '',
  date_of_birth: '',
  admission_date: '',
  address: '',
  caste_category: '',
  previous_school: '',
  image_url: '',
  ocr_raw_text: '',
}

const REQUIRED_FIELDS: (keyof GRRecordData)[] = [
  'gr_number',
  'student_name',
  'fathers_name',
  'surname',
  'date_of_birth',
  'admission_date',
]

const FIELD_LABELS: Record<string, string> = {
  gr_number: 'GR Number',
  student_name: 'Student Name',
  fathers_name: "Father's Name",
  mothers_name: "Mother's Name",
  surname: 'Surname',
  date_of_birth: 'Date of Birth',
  admission_date: 'Admission Date',
  address: 'Address',
  caste_category: 'Caste / Category',
  previous_school: 'Previous School',
}

// Parseable field keys (exclude image_url, ocr_raw_text, id)
const PARSEABLE_FIELDS: (keyof ParsedGRFields)[] = [
  'gr_number', 'student_name', 'fathers_name', 'mothers_name',
  'surname', 'date_of_birth', 'admission_date', 'address',
  'caste_category', 'previous_school',
]

// ── Component ─────────────────────────────────────────────────
export default function GRRecordForm({ mode, initialData }: GRRecordFormProps) {
  const router = useRouter()
  const { profile } = useAuth()

  const [form, setForm] = useState<GRRecordData>({ ...EMPTY_FORM, ...initialData })
  const [errors, setErrors] = useState<Partial<Record<keyof GRRecordData, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // OCR state
  const [ocrText, setOcrText] = useState<string>(initialData?.ocr_raw_text || '')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrMode, setOcrMode] = useState<'real' | 'mock' | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)

  // Auto-fill state
  const [parsedFields, setParsedFields] = useState<ParsedGRFields>({})
  const [autoFilledFields, setAutoFilledFields] = useState<Set<keyof ParsedGRFields>>(new Set())
  const [showRawText, setShowRawText] = useState(false)

  // Sync initialData on change (for edit mode)
  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }))
      if (initialData.ocr_raw_text) setOcrText(initialData.ocr_raw_text)
    }
  }, [initialData])

  // ── Auto-fill from parsed OCR ──────────────────────────
  const autoFillFromOcr = useCallback((rawText: string) => {
    const parsed = parseGRFields(rawText)
    setParsedFields(parsed)

    const filledKeys = new Set<keyof ParsedGRFields>()
    const updates: Partial<GRRecordData> = {}

    for (const field of PARSEABLE_FIELDS) {
      const parsedField = parsed[field]
      if (parsedField?.value) {
        updates[field] = parsedField.value
        filledKeys.add(field)
      }
    }

    if (Object.keys(updates).length > 0) {
      setForm((prev) => ({ ...prev, ...updates }))
      setAutoFilledFields(filledKeys)
    }
  }, [])

  // ── Field change handler ────────────────────────────────
  function updateField(field: keyof GRRecordData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Clear error on edit
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    // If user edits an auto-filled field, remove the auto-fill indicator
    if (autoFilledFields.has(field as keyof ParsedGRFields)) {
      setAutoFilledFields((prev) => {
        const next = new Set(prev)
        next.delete(field as keyof ParsedGRFields)
        return next
      })
    }
  }

  // ── Validation ──────────────────────────────────────────
  function validate(): boolean {
    const newErrors: Partial<Record<keyof GRRecordData, string>> = {}
    for (const field of REQUIRED_FIELDS) {
      if (!form[field]?.trim()) {
        newErrors[field] = `${FIELD_LABELS[field]} is required`
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── Image upload callback ───────────────────────────────
  async function handleImageUpload(storagePath: string) {
    updateField('image_url', storagePath)

    // Trigger OCR
    setOcrLoading(true)
    setOcrError(null)
    setParsedFields({})
    setAutoFilledFields(new Set())

    try {
      // Get the file from storage to send to OCR
      const { data: fileData, error: dlError } = await supabase.storage
        .from('gr-images')
        .download(storagePath)

      if (dlError || !fileData) {
        console.error('Failed to download for OCR:', dlError?.message)
        setOcrError('We couldn\'t read the uploaded image for text extraction. You can still fill in the fields manually.')
        setOcrLoading(false)
        return
      }

      // Convert blob to File for FormData
      const formData = new FormData()
      formData.append('image', fileData, 'scan.jpg')

      const res = await fetch('/api/ocr-test', {
        method: 'POST',
        body: formData,
      })

      const result = await res.json()

      if (res.status === 429) {
        setOcrError('The text recognition service is temporarily at capacity. Your image was uploaded successfully — you can fill in the fields manually for now, or try OCR again in a few minutes.')
      } else if (!res.ok || result.error) {
        setOcrError('We couldn\'t read the text from your image automatically. This can happen with heavily faded or unclear handwriting. You can still fill in the fields manually.')
      } else if (result.text) {
        setOcrText(result.text)
        setOcrMode(result.mode)
        updateField('ocr_raw_text', result.text)

        // ✨ Auto-fill form fields from parsed OCR
        autoFillFromOcr(result.text)
      }
    } catch (err) {
      console.error('OCR error:', err)
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setOcrError('Text extraction failed — it looks like your internet connection was interrupted. Your image was uploaded successfully. You can fill in the fields manually.')
      } else {
        setOcrError('We couldn\'t read the text from your image automatically. This can happen with heavily faded or unclear handwriting. You can still fill in the fields manually.')
      }
    } finally {
      setOcrLoading(false)
    }
  }

  // ── Submit ──────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)

    if (!validate()) return
    if (!profile) {
      setSaveError('You must be logged in.')
      return
    }

    setSaving(true)

    try {
      if (mode === 'create') {
        const { error } = await supabase.from('gr_records').insert({
          school_id: profile.school_id,
          gr_number: form.gr_number.trim(),
          student_name: form.student_name.trim(),
          fathers_name: form.fathers_name.trim(),
          mothers_name: form.mothers_name.trim() || null,
          surname: form.surname.trim(),
          date_of_birth: form.date_of_birth,
          admission_date: form.admission_date,
          address: form.address.trim() || null,
          caste_category: form.caste_category.trim() || null,
          previous_school: form.previous_school.trim() || null,
          image_url: form.image_url || null,
          ocr_raw_text: form.ocr_raw_text || null,
          created_by: profile.id,
        })

        if (error) throw error
      } else {
        // Edit mode — update
        if (!initialData?.id) throw new Error('Record ID missing for update')

        const { error } = await supabase
          .from('gr_records')
          .update({
            gr_number: form.gr_number.trim(),
            student_name: form.student_name.trim(),
            fathers_name: form.fathers_name.trim(),
            mothers_name: form.mothers_name.trim() || null,
            surname: form.surname.trim(),
            date_of_birth: form.date_of_birth,
            admission_date: form.admission_date,
            address: form.address.trim() || null,
            caste_category: form.caste_category.trim() || null,
            previous_school: form.previous_school.trim() || null,
            image_url: form.image_url || null,
          })
          .eq('id', initialData.id)

        if (error) throw error
      }

      router.push('/dashboard/records')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSaveError(`Save failed: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Confidence badge ───────────────────────────────────
  function ConfidenceDot({ field }: { field: keyof GRRecordData }) {
    const parsed = parsedFields[field as keyof ParsedGRFields]
    const isAutoFilled = autoFilledFields.has(field as keyof ParsedGRFields)

    if (!parsed || !isAutoFilled) return null

    const colors = {
      high: 'bg-emerald-400',
      medium: 'bg-amber-400',
      low: 'bg-red-400',
    }

    const labels = {
      high: 'High confidence',
      medium: 'Medium confidence — please verify',
      low: 'Low confidence — please verify',
    }

    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${colors[parsed.confidence]} ml-1.5`}
        title={labels[parsed.confidence]}
      />
    )
  }

  // ── Render helpers ──────────────────────────────────────
  function renderInput(
    field: keyof GRRecordData,
    type: string = 'text',
    opts?: { placeholder?: string; rows?: number }
  ) {
    const isRequired = REQUIRED_FIELDS.includes(field)
    const hasError = !!errors[field]
    const isAutoFilled = autoFilledFields.has(field as keyof ParsedGRFields)

    const baseClasses = `w-full rounded-xl px-3 py-2.5 text-sm transition glass-input min-h-[44px] ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/50'
        : isAutoFilled
        ? 'border-emerald-300 bg-emerald-50/30'
        : ''
    }`

    return (
      <div>
        <label htmlFor={`field-${field}`} className="flex items-center text-sm font-bold text-[#0f2846]/80 mb-1">
          {FIELD_LABELS[field]}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
          <ConfidenceDot field={field} />
        </label>

        {type === 'textarea' ? (
          <textarea
            id={`field-${field}`}
            value={form[field]}
            onChange={(e) => updateField(field, e.target.value)}
            rows={opts?.rows || 3}
            placeholder={opts?.placeholder}
            className={baseClasses + ' resize-none'}
          />
        ) : (
          <input
            id={`field-${field}`}
            type={type}
            value={form[field]}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={opts?.placeholder}
            className={baseClasses}
          />
        )}

        {hasError && (
          <p className="text-xs text-red-400 mt-1">{errors[field]}</p>
        )}
      </div>
    )
  }

  // ── Auto-fill summary ──────────────────────────────────
  const parsedCount = countParsedFields(parsedFields)

  // ── Layout ──────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Row 1: Image Upload + OCR Panel (create mode only) */}
      {mode === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Upload */}
          <div className="rounded-[24px] glass-panel p-6 space-y-3 shadow-sm">
            <h2 className="text-sm font-bold text-[#0f2846] uppercase tracking-wider">
              1. Upload Scanned Image
            </h2>
            <p className="text-xs text-[#0f2846]/60">
              Upload a photo or scan of the GR register page.
            </p>
            <ImageUploader
              onUpload={handleImageUpload}
            />
          </div>

          {/* OCR / Scan Results Panel */}
          <div className="rounded-[24px] glass-panel p-6 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0f2846] uppercase tracking-wider">
                Scan Results
              </h2>
              {ocrMode && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${
                    ocrMode === 'mock'
                      ? 'bg-amber-50 border border-amber-200 text-amber-600'
                      : 'bg-[#6b9e78]/10 border border-[#6b9e78]/30 text-[#6b9e78]'
                  }`}
                >
                  {ocrMode === 'mock' ? '🧪 Mock' : '✅ Real'}
                </span>
              )}
            </div>

            {ocrLoading ? (
              <div className="flex flex-col items-center gap-3 text-[#0f2846]/60 py-8">
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-medium">Scanning & extracting fields…</span>
                <span className="text-xs text-[#0f2846]/40">This may take a few seconds</span>
              </div>
            ) : parsedCount.total > 0 ? (
              <>
                {/* Auto-fill success banner */}
                <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">✨</span>
                    <div>
                      <p className="text-sm font-bold text-emerald-800">
                        {parsedCount.total} field{parsedCount.total !== 1 ? 's' : ''} auto-filled from scan
                      </p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Please review each field below and correct any mistakes.
                        {parsedCount.medium + parsedCount.low > 0 && (
                          <> Fields with <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mx-0.5 align-middle" /> amber dots need extra attention.</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Parsed fields summary */}
                <div className="space-y-2">
                  {PARSEABLE_FIELDS.map((field) => {
                    const parsed = parsedFields[field]
                    if (!parsed) return null
                    return (
                      <div key={field} className="flex items-start gap-2 text-sm">
                        <span
                          className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                            parsed.confidence === 'high' ? 'bg-emerald-400' :
                            parsed.confidence === 'medium' ? 'bg-amber-400' :
                            'bg-red-400'
                          }`}
                        />
                        <span className="text-[#0f2846]/50 font-medium min-w-[100px]">
                          {FIELD_LABELS[field]}:
                        </span>
                        <span className="text-[#0f2846]/80 font-semibold">
                          {parsed.value}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Collapsible raw text */}
                <button
                  type="button"
                  onClick={() => setShowRawText(!showRawText)}
                  className="text-xs text-[#0f2846]/50 hover:text-[#0f2846]/70 font-medium transition flex items-center gap-1"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${showRawText ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {showRawText ? 'Hide' : 'Show'} raw OCR text
                </button>

                {showRawText && (
                  <pre className="whitespace-pre-wrap text-xs text-[#0f2846]/60 bg-white/40 rounded-xl border border-white/40 p-3 max-h-[200px] overflow-y-auto font-mono leading-relaxed">
                    {ocrText}
                  </pre>
                )}
              </>
            ) : ocrText && parsedCount.total === 0 ? (
              <>
                {/* OCR worked but parser couldn't extract fields */}
                <div className="rounded-xl bg-amber-50/80 border border-amber-200 px-4 py-3 shadow-sm">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-amber-800">Text detected but fields couldn&apos;t be identified</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        The scan picked up text but couldn&apos;t match it to specific fields. This can happen with unusual layouts. Please fill in the fields manually using the text below.
                      </p>
                    </div>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-[#0f2846]/80 bg-white/40 rounded-xl border border-white/40 p-4 max-h-[350px] overflow-y-auto font-mono leading-relaxed shadow-inner">
                  {ocrText}
                </pre>
              </>
            ) : ocrError ? (
              <div className="rounded-xl bg-amber-50/80 border border-amber-200 px-4 py-4 space-y-2 shadow-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-sm text-amber-700 font-medium">{ocrError}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-[#0f2846]/40 gap-2">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                <span className="text-sm font-medium">Upload an image to auto-detect fields</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing image preview (edit mode) */}
      {mode === 'edit' && form.image_url && (
        <div className="rounded-[24px] glass-panel p-6 shadow-sm">
          <h2 className="text-sm font-bold text-[#0f2846] uppercase tracking-wider mb-4">
            Scanned Image
          </h2>
          <ImagePreview storagePath={form.image_url} />
        </div>
      )}

      {/* Row 2: Form fields */}
      <div className="rounded-[24px] glass-panel p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0f2846] uppercase tracking-wider">
            {mode === 'create' ? '2. Student Details' : 'Student Details'}
          </h2>
          {autoFilledFields.size > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {autoFilledFields.size} auto-filled
            </span>
          )}
        </div>

        {/* Save error */}
        {saveError && (
          <div className="rounded-xl bg-red-50/80 border border-red-200 px-4 py-4 flex items-start gap-3 shadow-sm" role="alert">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">Couldn&apos;t save this record</p>
              <p className="text-xs text-red-600 mt-1">{saveError}</p>
            </div>
          </div>
        )}

        {/* Fields grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {renderInput('gr_number', 'text', { placeholder: 'e.g. 1247' })}
          {renderInput('student_name', 'text', { placeholder: 'Student full name' })}
          {renderInput('fathers_name', 'text', { placeholder: "Father's full name" })}
          {renderInput('mothers_name', 'text', { placeholder: "Mother's full name (optional)" })}
          {renderInput('surname', 'text', { placeholder: 'Family surname' })}
          {renderInput('caste_category', 'text', { placeholder: 'e.g. General, OBC, SC, ST' })}
          {renderInput('date_of_birth', 'date')}
          {renderInput('admission_date', 'date')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {renderInput('address', 'textarea', { placeholder: 'Full residential address', rows: 2 })}
          {renderInput('previous_school', 'text', { placeholder: 'Name of previous school (optional)' })}
        </div>

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t border-white/40">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-[#0f2846]/20 bg-white/50 px-4 py-2.5 text-sm font-semibold text-[#0f2846] hover:bg-white/80 transition min-h-[44px] w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            id="form-submit"
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#0f2846] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0f2846]/90 disabled:opacity-50 disabled:cursor-not-allowed transition min-h-[44px] w-full sm:w-auto shadow-md"
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Save Record' : 'Update Record'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Small helper: load image from storage for edit view ───────
function ImagePreview({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.storage
        .from('gr-images')
        .createSignedUrl(storagePath, 60 * 10)
      if (data?.signedUrl) setUrl(data.signedUrl)
    }
    load()
  }, [storagePath])

  if (!url) return <p className="text-sm text-[#0f2846]/60 font-medium">Loading image…</p>

  return (
    <img
      src={url}
      alt="GR scan"
      className="w-full max-h-64 object-contain rounded-xl border border-[#0f2846]/20 bg-white/40 shadow-sm"
    />
  )
}
