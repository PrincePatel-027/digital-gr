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
  'gr_number', 'student_name', 'fathers_name', 'surname', 'date_of_birth', 'admission_date',
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

  const [ocrText, setOcrText] = useState<string>(initialData?.ocr_raw_text || '')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrMode, setOcrMode] = useState<'real' | 'mock' | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)

  const [parsedFields, setParsedFields] = useState<ParsedGRFields>({})
  const [autoFilledFields, setAutoFilledFields] = useState<Set<keyof ParsedGRFields>>(new Set())
  const [showRawText, setShowRawText] = useState(false)

  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }))
      if (initialData.ocr_raw_text) setOcrText(initialData.ocr_raw_text)
    }
  }, [initialData])

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

  function updateField(field: keyof GRRecordData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => { const next = { ...prev }; delete next[field]; return next })
    }
    if (autoFilledFields.has(field as keyof ParsedGRFields)) {
      setAutoFilledFields((prev) => { const next = new Set(prev); next.delete(field as keyof ParsedGRFields); return next })
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof GRRecordData, string>> = {}
    for (const field of REQUIRED_FIELDS) {
      if (!form[field]?.trim()) newErrors[field] = `${FIELD_LABELS[field]} is required`
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleImageUpload(storagePath: string) {
    updateField('image_url', storagePath)
    setOcrLoading(true)
    setOcrError(null)
    setParsedFields({})
    setAutoFilledFields(new Set())

    try {
      const { data: fileData, error: dlError } = await supabase.storage.from('gr-images').download(storagePath)
      if (dlError || !fileData) {
        setOcrError('Couldn\'t read the uploaded image for text extraction.')
        setOcrLoading(false)
        return
      }

      const formData = new FormData()
      formData.append('image', fileData, 'scan.jpg')
      const res = await fetch('/api/ocr-test', { method: 'POST', body: formData })
      const result = await res.json()

      if (res.status === 429) {
        setOcrError('OCR service at capacity. Fill in fields manually or try again later.')
      } else if (!res.ok || result.error) {
        setOcrError('Couldn\'t extract text. Fill in fields manually.')
      } else if (result.text) {
        setOcrText(result.text)
        setOcrMode(result.mode)
        updateField('ocr_raw_text', result.text)
        autoFillFromOcr(result.text)
      }
    } catch (err) {
      console.error('OCR error:', err)
      setOcrError('Text extraction failed. Fill in fields manually.')
    } finally {
      setOcrLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    if (!validate()) return
    if (!profile) { setSaveError('You must be logged in.'); return }

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
        if (!initialData?.id) throw new Error('Record ID missing')
        const { error } = await supabase.from('gr_records').update({
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
        }).eq('id', initialData.id)
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
  const parsedCount = countParsedFields(parsedFields)

  function renderInput(
    field: keyof GRRecordData,
    type: string = 'text',
    opts?: { placeholder?: string; rows?: number }
  ) {
    const isRequired = REQUIRED_FIELDS.includes(field)
    const hasError = !!errors[field]
    const isAutoFilled = autoFilledFields.has(field as keyof ParsedGRFields)
    const parsed = parsedFields[field as keyof ParsedGRFields]

    return (
      <div>
        <label htmlFor={`field-${field}`} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b] mb-2">
          {FIELD_LABELS[field]}
          {isRequired && <span className="text-red-500">*</span>}
          {isAutoFilled && parsed && (
            <span className={`w-2 h-2 rounded-full ${
              parsed.confidence === 'high' ? 'bg-[#16a34a]' :
              parsed.confidence === 'medium' ? 'bg-[#d97706]' : 'bg-[#dc2626]'
            }`} title={`${parsed.confidence} confidence`} />
          )}
        </label>
        {type === 'textarea' ? (
          <textarea
            id={`field-${field}`}
            value={form[field]}
            onChange={(e) => updateField(field, e.target.value)}
            rows={opts?.rows || 3}
            placeholder={opts?.placeholder}
            className={`neu-input resize-none ${hasError ? 'neu-input-error' : ''} ${isAutoFilled ? 'border-[#16a34a]/40' : ''}`}
          />
        ) : (
          <input
            id={`field-${field}`}
            type={type}
            value={form[field]}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={opts?.placeholder}
            className={`neu-input ${hasError ? 'neu-input-error' : ''} ${isAutoFilled ? 'border-[#16a34a]/40' : ''}`}
          />
        )}
        {hasError && <p className="text-xs text-red-500 font-semibold mt-1">{errors[field]}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Upload + OCR */}
      {mode === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Upload */}
          <div className="neu-card p-5 sm:p-6 space-y-3">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b]">
              1. Upload Scan
            </h2>
            <ImageUploader onUpload={handleImageUpload} />
          </div>

          {/* Scan Results */}
          <div className="neu-card p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b]">
                Scan Results
              </h2>
              {ocrMode && (
                <span className={`neu-badge ${ocrMode === 'mock' ? 'bg-[#d97706]/10 text-[#d97706]' : 'bg-[#16a34a]/10 text-[#16a34a]'}`}>
                  {ocrMode === 'mock' ? 'Mock' : '✓ Real'}
                </span>
              )}
            </div>

            {ocrLoading ? (
              <div className="flex flex-col items-center gap-3 py-10 text-[#6b6b6b]">
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-bold">Scanning…</span>
              </div>
            ) : parsedCount.total > 0 ? (
              <>
                <div className="rounded-lg bg-[#16a34a]/10 border-2 border-[#16a34a]/20 px-4 py-3">
                  <p className="text-sm font-bold text-[#16a34a]">
                    ✨ {parsedCount.total} field{parsedCount.total !== 1 ? 's' : ''} detected
                  </p>
                  <p className="text-xs text-[#16a34a]/70 mt-0.5">Review and correct below</p>
                </div>

                <div className="space-y-1.5">
                  {PARSEABLE_FIELDS.map((field) => {
                    const p = parsedFields[field]
                    if (!p) return null
                    return (
                      <div key={field} className="flex items-start gap-2 text-sm">
                        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                          p.confidence === 'high' ? 'bg-[#16a34a]' : p.confidence === 'medium' ? 'bg-[#d97706]' : 'bg-[#dc2626]'
                        }`} />
                        <span className="text-[#9a9590] text-xs font-bold min-w-[80px]">{FIELD_LABELS[field]}</span>
                        <span className="text-[#1a1a1a] text-xs font-semibold">{p.value}</span>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setShowRawText(!showRawText)}
                  className="text-xs text-[#9a9590] hover:text-[#6b6b6b] font-bold transition flex items-center gap-1"
                >
                  <svg className={`w-3 h-3 transition-transform ${showRawText ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {showRawText ? 'Hide' : 'Show'} raw text
                </button>
                {showRawText && (
                  <pre className="whitespace-pre-wrap text-xs text-[#6b6b6b] bg-[#e8e4de] rounded-lg p-3 max-h-[200px] overflow-y-auto text-mono">{ocrText}</pre>
                )}
              </>
            ) : ocrText && parsedCount.total === 0 ? (
              <>
                <div className="rounded-lg bg-[#d97706]/10 border-2 border-[#d97706]/20 px-4 py-3">
                  <p className="text-sm font-bold text-[#d97706]">Text detected but fields not identified</p>
                  <p className="text-xs text-[#d97706]/70 mt-0.5">Fill in manually using the text below</p>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-[#6b6b6b] bg-[#e8e4de] rounded-lg p-3 max-h-[250px] overflow-y-auto text-mono">{ocrText}</pre>
              </>
            ) : ocrError ? (
              <div className="rounded-lg bg-[#d97706]/10 border-2 border-[#d97706]/20 px-4 py-3">
                <p className="text-sm font-bold text-[#d97706]">{ocrError}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-[#9a9590] gap-2">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                <span className="text-xs font-bold">Upload to auto-detect</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit mode image */}
      {mode === 'edit' && form.image_url && (
        <div className="neu-card p-5 sm:p-6">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b] mb-3">Scanned Image</h2>
          <ImagePreview storagePath={form.image_url} />
        </div>
      )}

      {/* Form Fields */}
      <div className="neu-card p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b]">
            {mode === 'create' ? '2. Student Details' : 'Student Details'}
          </h2>
          {autoFilledFields.size > 0 && (
            <span className="neu-badge bg-[#16a34a]/10 text-[#16a34a]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
              {autoFilledFields.size} auto-filled
            </span>
          )}
        </div>

        {saveError && (
          <div className="neu-card-flat p-4" style={{ borderColor: '#dc2626' }}>
            <p className="text-sm font-bold text-red-700">Save failed</p>
            <p className="text-xs text-red-600 mt-1">{saveError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          {renderInput('gr_number', 'text', { placeholder: 'e.g. 1247' })}
          {renderInput('student_name', 'text', { placeholder: 'Student full name' })}
          {renderInput('fathers_name', 'text', { placeholder: "Father's full name" })}
          {renderInput('mothers_name', 'text', { placeholder: "Mother's name (optional)" })}
          {renderInput('surname', 'text', { placeholder: 'Family surname' })}
          {renderInput('caste_category', 'text', { placeholder: 'e.g. General, OBC, SC, ST' })}
          {renderInput('date_of_birth', 'date')}
          {renderInput('admission_date', 'date')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          {renderInput('address', 'textarea', { placeholder: 'Full residential address', rows: 2 })}
          {renderInput('previous_school', 'text', { placeholder: 'Previous school (optional)' })}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-4 border-t-2 border-[#d4d0c8]">
          <button
            type="button"
            onClick={() => router.back()}
            className="neu-btn neu-btn-ghost w-full sm:w-auto text-xs"
          >
            Cancel
          </button>
          <button
            id="form-submit"
            type="submit"
            disabled={saving}
            className="neu-btn neu-btn-primary w-full sm:w-auto text-xs"
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Save Record' : 'Update Record'}
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

  if (!url) return <p className="text-sm text-[#6b6b6b] font-medium">Loading image…</p>
  return <img src={url} alt="GR scan" className="w-full max-h-64 object-contain rounded-lg bg-[#e8e4de]" />
}
