'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

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
  // Right page — શૈક્ષણિક વિગતો
  admission_date: string
  admission_standard: string
  progress_and_conduct: string
  leaving_date: string
  leaving_reason: string
  leaving_standard: string
  remarks: string
  // System
  image_url: string
  ocr_raw_text: string
  created_at: string
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

  useEffect(() => {
    if (!recordId || !profile) return
    async function loadRecord() {
      setLoading(true)
      const { data, error: fetchErr } = await supabase.from('gr_records').select('*').eq('id', recordId).single()
      if (fetchErr) {
        setError(fetchErr.message)
      } else if (data) {
        setRecord(data)
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
    if (!window.confirm(`Delete GR #${record.gr_number} for ${record.student_name}? This cannot be undone.`)) return
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
      <div className="flex items-center justify-center py-20 text-[#6b6b6b]">
        <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-semibold">Loading…</span>
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="space-y-4">
        <div className="neu-card-flat p-5" style={{ borderColor: '#dc2626' }}>
          <p className="text-sm font-bold text-red-700">Record not found or no access</p>
          <p className="text-xs text-red-600 mt-1">It may have been deleted.</p>
        </div>
        <button onClick={() => router.push('/dashboard/records')} className="text-sm font-bold text-[#4338ca] hover:underline min-h-[44px]">
          ← Back to records
        </button>
      </div>
    )
  }

  const canEdit = profile?.role === 'staff' || profile?.role === 'school_admin'
  const canDelete = profile?.role === 'school_admin'

  const Field = ({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) => (
    <div className="border-b border-[#d4d0c8] pb-3">
      <dt className="text-[10px] font-bold text-[#9a9590] uppercase tracking-wider mb-1">{label}</dt>
      <dd className={`text-sm font-bold ${mono ? 'text-mono' : ''}`}>
        {value || <span className="text-[#d4d0c8] font-medium">—</span>}
      </dd>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button onClick={() => router.push('/dashboard/records')} className="text-sm font-bold text-[#6b6b6b] hover:text-[#1a1a1a] mb-3 flex items-center min-h-[44px] transition">
          ← Back
        </button>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-mono text-xs font-bold bg-[#1a1a1a] text-[#f0ede8] px-2.5 py-1 rounded-md">
                GR-{record.gr_number}
              </span>
              {record.admission_standard && (
                <span className="text-mono text-xs font-bold bg-[#e8e4de] text-[#6b6b6b] px-2.5 py-1 rounded-md">
                  ધો. {record.admission_standard}
                </span>
              )}
              {record.leaving_date ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[#d97706]">
                  <span className="w-2 h-2 rounded-full bg-[#d97706]" />
                  Left
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[#16a34a]">
                  <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
                  Active
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {record.student_name} {record.surname}
            </h1>
            <p className="text-xs text-[#9a9590] font-semibold mt-1">
              Added {new Date(record.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {canEdit && (
              <Link href={`/dashboard/records/${record.id}/edit`} className="neu-btn neu-btn-ghost text-xs flex-1 sm:flex-none">
                Edit
              </Link>
            )}
            {canDelete && (
              <button onClick={handleDelete} disabled={deleting} className="neu-btn neu-btn-danger text-xs flex-1 sm:flex-none">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {deleteError && (
        <div className="neu-card-flat p-4" style={{ borderColor: '#dc2626' }}>
          <p className="text-sm font-bold text-red-700">{deleteError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Fields */}
        <div className="lg:col-span-2 space-y-5">

          {/* ── Section 1: મુખ્ય વિગતો (Left Page) ── */}
          <div className="neu-card p-5 sm:p-6">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b] mb-1">
              પત્રક ૪ — મુખ્ય વિગતો / Primary Details
            </h2>
            <p className="text-[10px] text-[#9a9590] mb-5">રજિસ્ટરનું ડાબું પાનું</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              <Field label="રજિસ્ટર નંબર / GR Number" value={record.gr_number} mono />
              <Field label="વિદ્યાર્થીનું નામ / Student Name" value={record.student_name} />
              <Field label="અટક / Surname" value={record.surname} />
              <Field label="પિતાનું નામ / Father's Name" value={record.fathers_name} />
              <Field label="માતાનું નામ / Mother's Name" value={record.mothers_name} />
              <Field label="ધર્મ / Religion" value={record.religion} />
              <Field label="જ્ઞાતિ / Caste" value={record.caste_category} />
              <Field label="જન્મ તારીખ (અંકમાં) / DOB" value={record.date_of_birth} mono />
              <Field label="જન્મ તારીખ (શબ્દોમાં) / DOB in Words" value={record.dob_in_words} />
              <Field label="જન્મ સ્થળ / Birth Place" value={record.birth_place} />
              <div className="sm:col-span-2"><Field label="ગામ / Village" value={record.address} /></div>
              <div className="sm:col-span-2"><Field label="છેલ્લી શાળા / Previous School" value={record.previous_school} /></div>
            </dl>
          </div>

          {/* ── Section 2: શૈક્ષણિક વિગતો (Right Page) ── */}
          <div className="neu-card p-5 sm:p-6">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b] mb-1">
              પત્રક ૫ — શૈક્ષણિક વિગતો / Academic Details
            </h2>
            <p className="text-[10px] text-[#9a9590] mb-5">રજિસ્ટરનું જમણું પાનું</p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              <Field label="દાખલ થયા તારીખ / Admission Date" value={record.admission_date} mono />
              <Field label="દાખલ થયા ધોરણ / Admission Std." value={record.admission_standard} />
              <div className="sm:col-span-2"><Field label="પ્રગતિ અને વર્તન / Progress & Conduct" value={record.progress_and_conduct} /></div>
              <Field label="શાળા છોડ્યા તારીખ / Leaving Date" value={record.leaving_date} mono />
              <Field label="છોડતી વખતે ધોરણ / Leaving Std." value={record.leaving_standard} />
              <div className="sm:col-span-2"><Field label="છોડવાનું કારણ / Reason for Leaving" value={record.leaving_reason} /></div>
              <div className="sm:col-span-2"><Field label="રીમાર્ક્સ / શેરો / Remarks" value={record.remarks} /></div>
            </dl>
          </div>

          {record.ocr_raw_text && (
            <div className="neu-card p-5 sm:p-6">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b] mb-3">OCR Text</h2>
              <pre className="whitespace-pre-wrap text-xs text-[#6b6b6b] bg-[#e8e4de] rounded-lg p-4 max-h-60 overflow-y-auto text-mono leading-relaxed">
                {record.ocr_raw_text}
              </pre>
            </div>
          )}
        </div>

        {/* Image */}
        <div>
          <div className="neu-card p-5 sm:p-6">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b] mb-4">Scan</h2>
            {imageUrl ? (
              <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border-2 border-[#1a1a1a] hover:border-[#4338ca] transition group relative">
                <img src={imageUrl} alt="GR scan" className="w-full h-auto object-contain bg-[#e8e4de]" />
                <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-[#f0ede8] text-[#1a1a1a] text-xs px-4 py-2 rounded-md font-bold shadow-md transition-opacity border-2 border-[#1a1a1a]">
                    View Full ↗
                  </span>
                </div>
              </a>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-[#d4d0c8] py-12 flex flex-col items-center justify-center text-[#9a9590]">
                <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-bold">No image</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
