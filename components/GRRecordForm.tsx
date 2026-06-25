'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
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

  // Sync initialData on change (for edit mode)
  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }))
      if (initialData.ocr_raw_text) setOcrText(initialData.ocr_raw_text)
    }
  }, [initialData])

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
      }
    } catch (err) {
      console.error('OCR error:', err)
      // Detect network errors
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

  // ── Render helpers ──────────────────────────────────────
  function renderInput(
    field: keyof GRRecordData,
    type: string = 'text',
    opts?: { placeholder?: string; rows?: number }
  ) {
    const isRequired = REQUIRED_FIELDS.includes(field)
    const hasError = !!errors[field]

    const baseClasses = `w-full rounded-xl px-3 py-2.5 text-sm transition glass-input min-h-[44px] ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-red-50/50'
        : ''
    }`

    return (
      <div>
        <label htmlFor={`field-${field}`} className="block text-sm font-bold text-[#0f2846]/80 mb-1">
          {FIELD_LABELS[field]}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
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

          {/* OCR Panel */}
          <div className="rounded-[24px] glass-panel p-6 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0f2846] uppercase tracking-wider">
                Extracted Text
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
              <div className="flex items-center gap-2 text-[#0f2846]/60 py-8 justify-center">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm font-medium">Running OCR…</span>
              </div>
            ) : ocrText ? (
              <>
                <div className="rounded-xl bg-amber-50/80 border border-amber-200 px-3 py-3 shadow-sm">
                  <p className="text-xs text-amber-700 font-medium leading-relaxed">
                    ⚠ Extracted text — handwriting recognition may contain errors. Please verify against the original image.
                  </p>
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
              <div className="flex items-center justify-center py-12 text-[#0f2846]/60 text-sm font-medium">
                Upload an image to extract text
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
        <h2 className="text-sm font-bold text-[#0f2846] uppercase tracking-wider">
          {mode === 'create' ? '2. Student Details' : 'Student Details'}
        </h2>

        {/* Save error */}
        {saveError && (
          <div className="rounded-xl bg-red-50/80 border border-red-200 px-4 py-4 flex items-start gap-3 shadow-sm" role="alert">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">Couldn't save this record</p>
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
