'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatGujaratLocationLabel } from '@/lib/gujarat-locations'
import { GR_RECORD_FIELD_ORDER, type GRRecordField } from '@/lib/gr-record-data'
import { parseVoiceEnglishMetadata } from '@/lib/voice-bilingual'
import type { VoiceEnglishMetadata, VoiceFieldSource, VoiceScript } from '@/lib/voice-types'
import { toGujaratiDigits, formatRegisterDate } from '@/lib/gujarati'

interface GRRecordData {
  id: string
  school_id: string
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
  previous_school_district: string
  previous_school_subdistrict: string
  // Right page — શૈક્ષણિક વિગતો
  admission_date: string
  admission_standard: string
  progress_and_conduct: string
  leaving_date: string
  leaving_reason: string
  leaving_standard: string
  remarks: string
  // System
  image_url: string | null
  ocr_raw_text: string | null
  fields_en: VoiceEnglishMetadata | null
  created_at: string
}

const SOURCE_LABELS: Record<VoiceFieldSource, string> = {
  ai: 'AI',
  'canonical-lgd': 'LGD',
  shared: 'Shared',
  clerk: 'Edited',
  'single-script': 'Single script',
}

/** One ruled line of the register: Gujarati caption, English sub-caption, value. */
function Entry({
  gu,
  en,
  value,
  mono,
  wide,
  source,
}: {
  gu: string
  en: string
  value?: string | null
  mono?: boolean
  wide?: boolean
  source?: VoiceFieldSource
}) {
  return (
    <div className={`py-2.5 border-b border-rule ${wide ? 'sm:col-span-2' : ''}`}>
      <dt>
        <span className="label-gu">{gu}</span>
        <span className="label-en">{en}</span>
        {source && (
          <span className="neu-badge bg-surface-2 text-ink-soft text-[9px] px-1.5 py-0.5 mt-1" title={`Value source: ${SOURCE_LABELS[source]}`}>
            {SOURCE_LABELS[source]}
          </span>
        )}
      </dt>
      <dd className={`field-value mt-1 ${mono ? 'text-mono' : 'font-gujarati'}`}>
        {value ? value : <span className="text-ink-faint font-normal text-sm">—</span>}
      </dd>
    </div>
  )
}

export default function RecordDetailPage() {
  const router = useRouter()
  const params = useParams()
  const recordId = params.id as string
  const { profile, loading: authLoading } = useAuth()

  const [record, setRecord] = useState<GRRecordData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [detailScript, setDetailScript] = useState<VoiceScript>('gu')

  useEffect(() => {
    if (!recordId || !profile) return
    async function loadRecord() {
      setLoading(true)
      const { data, error: fetchErr } = await supabase.from('gr_records').select('*').eq('id', recordId).single()
      if (fetchErr) {
        setError(fetchErr.message)
      } else if (data) {
        setRecord({ ...data, fields_en: parseVoiceEnglishMetadata(data.fields_en) })
        if (data.image_url) {
          const { data: urlData } = await supabase.storage.from('gr-images').createSignedUrl(data.image_url, 60 * 60)
          if (urlData?.signedUrl) setImageUrl(urlData.signedUrl)
        }
      }
      setLoading(false)
    }
    loadRecord()
  }, [recordId, profile])

  const handleDelete = async () => {
    if (!record) return
    if (!window.confirm(`Delete GR ${record.gr_number} — ${record.student_name}? This cannot be undone.`)) return
    setDeleting(true)
    setDeleteError(null)
    try {
      if (record.image_url) await supabase.storage.from('gr-images').remove([record.image_url])
      const { error: delErr } = await supabase.from('gr_records').delete().eq('id', record.id)
      if (delErr) throw delErr
      router.push('/dashboard/records')
    } catch (err) {
      setDeleteError(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
      setDeleting(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-soft">
        <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-medium">Opening entry…</span>
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="space-y-4">
        <div className="neu-card-flat p-5" style={{ borderColor: '#a8322b' }}>
          <p className="text-sm font-semibold text-error">This entry isn&apos;t in your register</p>
          <p className="text-xs text-ink-soft mt-1">
            It may have been deleted, or it belongs to another school.
          </p>
        </div>
        <button onClick={() => router.push('/dashboard/records')} className="text-sm font-semibold text-accent hover:underline min-h-[44px]">
          ← Back to the register
        </button>
      </div>
    )
  }

  const canEdit = profile?.role === 'staff' || profile?.role === 'school_admin'
  const canDelete = profile?.role === 'school_admin'
  const hasLeft = !!record.leaving_date
  const hasSpokenAudit = record.ocr_raw_text?.includes('===== SPOKEN (') ?? false
  const hasEnglishMetadata = Boolean(record.fields_en && Object.keys(record.fields_en).length > 0)
  const displayValues = Object.fromEntries(GR_RECORD_FIELD_ORDER.map((field) => {
    const mainValue = record[field]
    const value = detailScript === 'en'
      ? record.fields_en?.[field]?.value ?? mainValue
      : mainValue
    if (field === 'previous_school_district' || field === 'previous_school_subdistrict') {
      return [field, formatGujaratLocationLabel(mainValue, detailScript)]
    }
    return [field, value]
  })) as Record<GRRecordField, string>

  return (
    <div className="space-y-5">
      {/* ══ Back link ═════════════════════════════════════════ */}
      <button
        onClick={() => router.push('/dashboard/records')}
        className="no-print text-sm font-medium text-ink-soft hover:text-ink inline-flex items-center gap-1.5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to the register
      </button>

      {/* ══ Entry header ══════════════════════════════════════ */}
      <div className="neu-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <span className={`gr-stamp gr-stamp-lg shrink-0 ${hasLeft ? 'gr-stamp-left' : ''}`}>
              {record.gr_number}
            </span>
            <div className="min-w-0">
              <p className="eyebrow mb-1">
                {profile?.schools?.name} · રજી. નં {toGujaratiDigits(record.gr_number)}
              </p>
              <h1 className="font-gujarati-serif text-2xl sm:text-3xl leading-tight">
                {displayValues.student_name} {displayValues.surname}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                {displayValues.admission_standard && (
                  <span className={detailScript === 'gu' ? 'font-gujarati text-ink-soft' : 'text-ink-soft'}>
                    {detailScript === 'gu' ? 'ધોરણ' : 'Standard'}{' '}
                    <span className="font-semibold text-ink">
                      {detailScript === 'gu' ? toGujaratiDigits(displayValues.admission_standard) : displayValues.admission_standard}
                    </span>
                  </span>
                )}
                {hasLeft ? (
                  <span className={`${detailScript === 'gu' ? 'font-gujarati' : ''} font-semibold text-red-ink`}>
                    {detailScript === 'gu' ? 'છોડી ગયા' : 'Left'} · {formatRegisterDate(displayValues.leaving_date)}
                  </span>
                ) : (
                  <span className={`${detailScript === 'gu' ? 'font-gujarati' : ''} font-semibold text-accent`}>
                    {detailScript === 'gu' ? 'ચાલુ' : 'Current'}
                  </span>
                )}
                <span className="text-ink-faint">
                  Added {formatRegisterDate(record.created_at.slice(0, 10))}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 no-print shrink-0">
            <button
              onClick={() => window.print()}
              className="neu-btn neu-btn-ghost min-h-[42px] px-4 text-sm"
              title="Print this entry"
            >
              Print
            </button>
            {canEdit && (
              <Link href={`/dashboard/records/${record.id}/edit`} className="neu-btn neu-btn-ghost min-h-[42px] px-4 text-sm">
                Edit
              </Link>
            )}
            {canDelete && (
              <button onClick={handleDelete} disabled={deleting} className="neu-btn neu-btn-danger min-h-[42px] px-4 text-sm">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {deleteError && (
        <div className="neu-card-flat p-4" style={{ borderColor: '#a8322b' }}>
          <p className="text-sm font-semibold text-error">{deleteError}</p>
        </div>
      )}

      {hasEnglishMetadata && (
        <div className="neu-card p-4 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink">Record script</p>
              <p className="text-[11px] text-ink-soft mt-0.5">Switch locally between the reviewed Gujarati columns and preserved English voice values.</p>
            </div>
            <div className="inline-grid grid-cols-2 gap-1 self-start" role="group" aria-label="Record detail script">
              <button
                type="button"
                onClick={() => setDetailScript('gu')}
                aria-pressed={detailScript === 'gu'}
                className={`neu-btn px-3 py-2 text-xs ${detailScript === 'gu' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
              >
                ગુજરાતી
              </button>
              <button
                type="button"
                onClick={() => setDetailScript('en')}
                aria-pressed={detailScript === 'en'}
                className={`neu-btn px-3 py-2 text-xs ${detailScript === 'en' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
              >
                English
              </button>
            </div>
          </div>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {detailScript === 'gu' ? 'Showing Gujarati record values.' : 'Showing preserved English record values.'}
          </p>
        </div>
      )}

      {/* ══ THE SPREAD: પત્રક ૪ | પત્રક ૫ ═════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Left page */}
        <section className="neu-card overflow-hidden">
          <header className="px-5 py-3 border-b border-line-strong bg-surface-2 flex items-baseline justify-between">
            <div>
              <h2 className="font-gujarati-serif text-sm font-semibold">પત્રક ૪ — મુખ્ય વિગતો</h2>
              <p className="label-en">Left page · personal details</p>
            </div>
            <span className="eyebrow">૪</span>
          </header>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 px-5 pb-4">
            <Entry gu="રજીસ્ટર નંબર" en="GR number" value={displayValues.gr_number} mono />
            <Entry gu="પુરૂં નામ" en="Student name" value={displayValues.student_name} source={detailScript === 'en' ? record.fields_en?.student_name?.source : undefined} />
            <Entry gu="અટક" en="Surname" value={displayValues.surname} source={detailScript === 'en' ? record.fields_en?.surname?.source : undefined} />
            <Entry gu="પિતાનું નામ" en="Father's name" value={displayValues.fathers_name} source={detailScript === 'en' ? record.fields_en?.fathers_name?.source : undefined} />
            <Entry gu="માતાનું નામ" en="Mother's name" value={displayValues.mothers_name} source={detailScript === 'en' ? record.fields_en?.mothers_name?.source : undefined} />
            <Entry gu="ધર્મ" en="Religion" value={displayValues.religion} source={detailScript === 'en' ? record.fields_en?.religion?.source : undefined} />
            <Entry gu="જ્ઞાતિ / જાત" en="Caste" value={displayValues.caste_category} source={detailScript === 'en' ? record.fields_en?.caste_category?.source : undefined} />
            <Entry gu="જન્મ તારીખ" en="Date of birth" value={formatRegisterDate(displayValues.date_of_birth)} mono />
            <Entry gu="જન્મ તારીખ (શબ્દોમાં)" en="DOB in words" value={displayValues.dob_in_words} source={detailScript === 'en' ? record.fields_en?.dob_in_words?.source : undefined} wide />
            <Entry gu="જન્મભૂમિ" en="Birth place" value={displayValues.birth_place} source={detailScript === 'en' ? record.fields_en?.birth_place?.source : undefined} />
            <Entry gu="ગામ / રહેઠાણ" en="Village / address" value={displayValues.address} source={detailScript === 'en' ? record.fields_en?.address?.source : undefined} />
            <Entry gu="છેલ્લી નિશાળ" en="Previous school" value={displayValues.previous_school} source={detailScript === 'en' ? record.fields_en?.previous_school?.source : undefined} wide />
            <Entry
              gu="છેલ્લી શાળાનો જિલ્લો"
              en="Previous-school district"
              value={displayValues.previous_school_district}
              source={detailScript === 'en' ? record.fields_en?.previous_school_district?.source : undefined}
            />
            <Entry
              gu="છેલ્લી શાળાનો તાલુકો"
              en="Previous-school taluka"
              value={displayValues.previous_school_subdistrict}
              source={detailScript === 'en' ? record.fields_en?.previous_school_subdistrict?.source : undefined}
            />
          </dl>
        </section>

        {/* Right page */}
        <section className="neu-card overflow-hidden">
          <header className="px-5 py-3 border-b border-line-strong bg-surface-2 flex items-baseline justify-between">
            <div>
              <h2 className="font-gujarati-serif text-sm font-semibold">પત્રક ૫ — શૈક્ષણિક વિગતો</h2>
              <p className="label-en">Right page · schooling &amp; leaving</p>
            </div>
            <span className="eyebrow">૫</span>
          </header>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 px-5 pb-4">
            <Entry gu="દાખલ થયા તારીખ" en="Admission date" value={formatRegisterDate(displayValues.admission_date)} mono />
            <Entry
              gu="દાખલ થયા ધોરણ"
              en="Admission standard"
              value={displayValues.admission_standard
                ? detailScript === 'gu' ? toGujaratiDigits(displayValues.admission_standard) : displayValues.admission_standard
                : ''}
              source={detailScript === 'en' ? record.fields_en?.admission_standard?.source : undefined}
            />
            <Entry gu="પ્રગતિ અને વર્તન" en="Progress & conduct" value={displayValues.progress_and_conduct} source={detailScript === 'en' ? record.fields_en?.progress_and_conduct?.source : undefined} wide />
            <Entry gu="નિશાળ છોડ્યા તારીખ" en="Leaving date" value={formatRegisterDate(displayValues.leaving_date)} mono />
            <Entry
              gu="છોડ્યા ત્યારે ધોરણ"
              en="Standard when leaving"
              value={displayValues.leaving_standard
                ? detailScript === 'gu' ? toGujaratiDigits(displayValues.leaving_standard) : displayValues.leaving_standard
                : ''}
              source={detailScript === 'en' ? record.fields_en?.leaving_standard?.source : undefined}
            />
            <Entry gu="છોડવાનું કારણ" en="Reason for leaving" value={displayValues.leaving_reason} source={detailScript === 'en' ? record.fields_en?.leaving_reason?.source : undefined} wide />
            <Entry gu="શેરો / રીમાર્ક્સ" en="Remarks" value={displayValues.remarks} source={detailScript === 'en' ? record.fields_en?.remarks?.source : undefined} wide />
          </dl>
        </section>
      </div>

      {/* ══ The scanned page ══════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
        <section className="neu-card overflow-hidden">
          <header className="px-5 py-3 border-b border-line-strong bg-surface-2">
            <h2 className="font-gujarati-serif text-sm font-semibold">મૂળ પાનું</h2>
            <p className="label-en">The scanned register page</p>
          </header>
          <div className="p-5">
            {imageUrl ? (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block border border-line-strong hover:border-accent transition-colors group relative"
              >
                <img
                  src={imageUrl}
                  alt={`Scanned register page for ${record.student_name}`}
                  className="w-full h-auto object-contain bg-surface-2"
                />
                <span className="no-print absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="bg-ink text-white text-xs px-4 py-2 font-semibold rounded-sm">
                    Open full size ↗
                  </span>
                </span>
              </a>
            ) : (
              <div className="ruled border border-dashed border-line-strong py-14 flex flex-col items-center justify-center text-ink-faint">
                <span className="text-xs font-medium">No scan attached to this entry</span>
              </div>
            )}
          </div>
        </section>

        {/* Extracted text, folded away by default */}
        {record.ocr_raw_text && (
          <section className="neu-card overflow-hidden no-print">
            <header className="px-5 py-3 border-b border-line-strong bg-surface-2 flex items-center justify-between">
              <div>
                <h2 className="font-gujarati-serif text-sm font-semibold">સ્રોત લખાણ</h2>
                <p className="label-en">{hasSpokenAudit ? 'Voice transcript audit trail' : 'Text read from the page'}</p>
              </div>
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="text-xs font-semibold text-accent hover:underline shrink-0"
              >
                {showRaw ? 'Hide' : 'Show'}
              </button>
            </header>
            {showRaw && (
              <pre className="whitespace-pre-wrap text-xs text-ink-soft bg-surface-2 m-5 p-4 max-h-72 overflow-y-auto text-mono leading-relaxed border border-line">
                {record.ocr_raw_text}
              </pre>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
