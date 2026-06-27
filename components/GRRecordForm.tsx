'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { parseGRTable, countParsedFields, type ParsedGRFields, type ParsedField } from '@/lib/ocr-parser'
import ImageUploader from '@/components/ImageUploader'

// ── Types ─────────────────────────────────────────────────────
export interface GRRecordData {
  id?: string
  // Left page — મુખ્ય વિગતો
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
  // Right page — શૈક્ષણિક વિગતો
  admission_date: string
  admission_standard: string
  progress_and_conduct: string
  leaving_date: string
  leaving_reason: string
  leaving_standard: string
  remarks: string
  // System fields
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

  // Multi-record support
  const [parsedRecords, setParsedRecords] = useState<ParsedGRFields[]>([])
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null)
  const [autoFilledFields, setAutoFilledFields] = useState<Set<keyof ParsedGRFields>>(new Set())
  const [showRawText, setShowRawText] = useState(false)

  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }))
      if (initialData.ocr_raw_text) setOcrText(initialData.ocr_raw_text)
    }
  }, [initialData])

  const applyParsedRecord = useCallback((parsed: ParsedGRFields) => {
    const filledKeys = new Set<keyof ParsedGRFields>()
    const updates: Partial<GRRecordData> = {}
    
    // Clear out previous auto-filled data before applying new selection
    const resetForm = { ...EMPTY_FORM, image_url: form.image_url, ocr_raw_text: form.ocr_raw_text }

    for (const field of PARSEABLE_FIELDS) {
      const parsedField = parsed[field]
      if (parsedField?.value) {
        updates[field] = parsedField.value
        filledKeys.add(field)
      }
    }
    
    setForm({ ...resetForm, ...updates })
    setAutoFilledFields(filledKeys)
    setErrors({}) // clear errors on new selection
  }, [form.image_url, form.ocr_raw_text])

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
      if (!form[field]?.trim()) newErrors[field] = `${FIELD_LABELS[field].split(' /')[0]} is required`
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleImageUpload(storagePath: string) {
    updateField('image_url', storagePath)
    setOcrLoading(true)
    setOcrError(null)
    setParsedRecords([])
    setSelectedRecordIndex(null)
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
        
        // Tabular Parsing
        const tableRecords = parseGRTable(result.text)
        setParsedRecords(tableRecords)

        if (tableRecords.length === 1) {
          // Auto-select if only 1 student is found
          applyParsedRecord(tableRecords[0])
          setSelectedRecordIndex(0)
        }
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
    if (!validate()) {
      // Scroll to top to see errors easily
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!profile) { setSaveError('You must be logged in.'); return }

    setSaving(true)
    try {
      const payload = {
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
        image_url: form.image_url || null,
      }

      if (mode === 'create') {
        const { error } = await supabase.from('gr_records').insert({
          ...payload,
          school_id: profile.school_id,
          ocr_raw_text: form.ocr_raw_text || null,
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

  function renderInput(
    field: keyof GRRecordData,
    type: string = 'text',
    opts?: { placeholder?: string; rows?: number }
  ) {
    const isRequired = REQUIRED_FIELDS.includes(field)
    const hasError = !!errors[field]
    const isAutoFilled = autoFilledFields.has(field as keyof ParsedGRFields)
    const parsed = selectedParsedFields ? selectedParsedFields[field as keyof ParsedGRFields] : null

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
                <span className="text-sm font-bold">Scanning Table…</span>
              </div>
            ) : parsedRecords.length > 0 ? (
              <>
                <div className="rounded-lg bg-[#16a34a]/10 border-2 border-[#16a34a]/20 px-4 py-3 mb-3">
                  <p className="text-sm font-bold text-[#16a34a]">
                    ✨ {parsedRecords.length} student record{parsedRecords.length !== 1 ? 's' : ''} detected
                  </p>
                  <p className="text-xs text-[#16a34a]/70 mt-0.5">
                    {parsedRecords.length > 1 ? 'Select a student below to populate the form:' : 'Review extracted fields below:'}
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
                        className={`text-left p-3 rounded-lg border-2 transition ${
                          selectedRecordIndex === idx
                            ? 'border-[#16a34a] bg-[#16a34a]/10'
                            : 'border-[#d4d0c8] hover:border-[#1a1a1a] bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-[#1a1a1a] truncate pr-2">
                            {rec.student_name?.value || '(Unknown Name)'}
                          </span>
                          {selectedRecordIndex === idx && (
                            <span className="text-[#16a34a] flex-shrink-0">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#6b6b6b] mt-1 flex gap-3">
                          <span>GR: <span className="font-semibold text-mono">{rec.gr_number?.value || '-'}</span></span>
                          <span>DOB: <span className="font-semibold text-mono">{rec.date_of_birth?.value || '-'}</span></span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Student Fields Overview */}
                {selectedParsedFields && (
                  <div className={`space-y-1.5 max-h-[250px] overflow-y-auto ${parsedRecords.length > 1 ? 'mt-4 pt-4 border-t-2 border-[#d4d0c8]' : ''}`}>
                    {PARSEABLE_FIELDS.map((field) => {
                      const p = selectedParsedFields[field]
                      if (!p) return null
                      return (
                        <div key={field} className="flex items-start gap-2 text-sm">
                          <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                            p.confidence === 'high' ? 'bg-[#16a34a]' : p.confidence === 'medium' ? 'bg-[#d97706]' : 'bg-[#dc2626]'
                          }`} />
                          <span className="text-[#9a9590] text-xs font-bold min-w-[80px]">{FIELD_LABELS[field].split(' /')[0]}</span>
                          <span className="text-[#1a1a1a] text-xs font-semibold">{p.value}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowRawText(!showRawText)}
                  className="mt-3 text-xs text-[#9a9590] hover:text-[#6b6b6b] font-bold transition flex items-center gap-1"
                >
                  <svg className={`w-3 h-3 transition-transform ${showRawText ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {showRawText ? 'Hide' : 'Show'} raw text
                </button>
                {showRawText && (
                  <pre className="whitespace-pre-wrap text-xs text-[#6b6b6b] bg-[#e8e4de] rounded-lg p-3 mt-2 max-h-[200px] overflow-y-auto text-mono">{ocrText}</pre>
                )}
              </>
            ) : ocrText && parsedRecords.length === 0 ? (
              <>
                <div className="rounded-lg bg-[#d97706]/10 border-2 border-[#d97706]/20 px-4 py-3">
                  <p className="text-sm font-bold text-[#d97706]">Text detected but no student records identified</p>
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

      {/* ═══════════════════════════════════════════════════════
          SECTION 1: મુખ્ય વિગતો — Primary Details (Left Page)
          ═══════════════════════════════════════════════════════ */}
      <div className="neu-card p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b]">
              {mode === 'create' ? '2.' : ''} પત્રક ૪ — મુખ્ય વિગતો / Primary Details
            </h2>
            <p className="text-[10px] text-[#9a9590] mt-0.5">રજિસ્ટરનું ડાબું પાનું / Left page of register</p>
          </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          {renderInput('address', 'textarea', { placeholder: 'ગામ / વતન / રહેઠાણ', rows: 2 })}
          {renderInput('previous_school', 'text', { placeholder: 'છેલ્લી શાળાનું નામ (optional)' })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2: શૈક્ષણિક વિગતો — Academic Details (Right Page)
          ═══════════════════════════════════════════════════════ */}
      <div className="neu-card p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b]">
            {mode === 'create' ? '3.' : ''} પત્રક ૫ — શૈક્ષણિક વિગતો / Academic Details
          </h2>
          <p className="text-[10px] text-[#9a9590] mt-0.5">રજિસ્ટરનું જમણું પાનું / Right page of register</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          {renderInput('admission_date', 'date')}
          {renderInput('admission_standard', 'text', { placeholder: 'e.g. 1, 2, 3…' })}
          {renderInput('leaving_date', 'date')}
          {renderInput('leaving_standard', 'text', { placeholder: 'છોડતી વખતે ધોરણ' })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          {renderInput('progress_and_conduct', 'textarea', { placeholder: 'પ્રગતિ અને વર્તનની નોંધ', rows: 2 })}
          {renderInput('leaving_reason', 'textarea', { placeholder: 'e.g. અન્ય ગામ જવાને લીધે, અભ્યાસ પૂર્ણ', rows: 2 })}
        </div>

        <div className="grid grid-cols-1 gap-y-4">
          {renderInput('remarks', 'textarea', { placeholder: 'રીમાર્ક્સ / શેરો / અન્ય નોંધ', rows: 3 })}
        </div>
      </div>

      {/* Actions */}
      <div className="neu-card p-5 sm:p-6">
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
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
