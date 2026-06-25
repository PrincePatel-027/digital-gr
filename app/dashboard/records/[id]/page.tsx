'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface GRRecordData {
  id: string
  school_id: string
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
      const { data, error: fetchErr } = await supabase
        .from('gr_records')
        .select('*')
        .eq('id', recordId)
        .single()

      if (fetchErr) {
        setError(fetchErr.message)
      } else if (data) {
        setRecord(data)
        
        if (data.image_url) {
          const { data: urlData } = await supabase.storage
            .from('gr-images')
            .createSignedUrl(data.image_url, 60 * 60) // 1 hour expiry
          if (urlData?.signedUrl) {
            setImageUrl(urlData.signedUrl)
          }
        }
      }
      setLoading(false)
    }

    loadRecord()
  }, [recordId, profile])

  const handleDelete = async () => {
    if (!record) return
    const confirmed = window.confirm(
      `Are you sure you want to delete GR record #${record.gr_number} for ${record.student_name}? This action cannot be undone.`
    )
    if (!confirmed) return

    setDeleting(true)
    setDeleteError(null)
    try {
      // First try to delete the image from storage if it exists
      if (record.image_url) {
        await supabase.storage.from('gr-images').remove([record.image_url])
      }

      // Then delete the database row
      const { error: delErr } = await supabase
        .from('gr_records')
        .delete()
        .eq('id', record.id)

      if (delErr) throw delErr

      router.push('/dashboard/records')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setDeleteError(`We couldn't delete this record. Please try again. (${msg})`)
      setDeleting(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#0f2846]/60">
        <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading record details…
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50/80 border border-red-200 px-4 py-4 flex items-start gap-3 shadow-sm">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800">This record doesn't exist or you don't have access to view it</p>
            <p className="text-xs text-red-600 mt-1">It may have been deleted, or you might not have the right permissions.</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard/records')}
          className="text-[#3a86c6] hover:text-[#0f2846] text-sm underline min-h-[44px] inline-flex items-center font-medium transition"
        >
          ← Back to records
        </button>
      </div>
    )
  }

  const canEdit = profile?.role === 'staff' || profile?.role === 'school_admin'
  const canDelete = profile?.role === 'school_admin'

  const FieldView = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="border-b border-[#0f2846]/10 pb-3">
      <dt className="text-xs font-bold text-[#0f2846]/60 uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-sm text-[#0f2846] font-bold">{value || <span className="text-[#0f2846]/40 font-medium">—</span>}</dd>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/dashboard/records')}
            className="text-[#0f2846]/60 hover:text-[#0f2846] text-sm mb-3 flex items-center transition min-h-[44px] font-medium"
          >
            ← Back to records
          </button>
          <h1 className="text-3xl font-bold text-[#0f2846]">
            GR #{record.gr_number} — {record.student_name} {record.surname}
          </h1>
          <p className="text-[#0f2846]/70 mt-1 text-sm font-medium">
            Added on {new Date(record.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {canEdit && (
            <Link
              href={`/dashboard/records/${record.id}/edit`}
              className="rounded-xl border border-[#0f2846]/20 bg-white/50 px-4 py-2.5 text-sm font-semibold text-[#0f2846] hover:bg-white/80 transition text-center min-h-[44px] flex items-center justify-center shadow-sm"
            >
              Edit Record
            </Link>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50 min-h-[44px] shadow-sm"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {/* Delete error */}
      {deleteError && (
        <div className="rounded-xl bg-red-50/80 border border-red-200 px-4 py-3 flex items-start gap-2 shadow-sm">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm font-semibold text-red-700">{deleteError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Data Fields */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-[24px] glass-panel p-6 shadow-sm">
            <h2 className="text-sm font-bold text-[#0f2846] uppercase tracking-wider mb-5">
              Student Details
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <FieldView label="GR Number" value={record.gr_number} />
              <FieldView label="Student Name" value={record.student_name} />
              <FieldView label="Surname" value={record.surname} />
              <FieldView label="Father's Name" value={record.fathers_name} />
              <FieldView label="Mother's Name" value={record.mothers_name} />
              <FieldView label="Date of Birth" value={record.date_of_birth} />
              <FieldView label="Admission Date" value={record.admission_date} />
              <FieldView label="Caste / Category" value={record.caste_category} />
              <div className="sm:col-span-2">
                <FieldView label="Address" value={record.address} />
              </div>
              <div className="sm:col-span-2">
                <FieldView label="Previous School" value={record.previous_school} />
              </div>
            </dl>
          </div>

          {record.ocr_raw_text && (
            <div className="rounded-[24px] glass-panel p-6 shadow-sm">
              <h2 className="text-sm font-bold text-[#0f2846] uppercase tracking-wider mb-3">
                Extracted OCR Text
              </h2>
              <pre className="whitespace-pre-wrap text-sm text-[#0f2846]/80 bg-white/40 rounded-xl p-4 max-h-60 overflow-y-auto font-mono leading-relaxed border border-white/40 shadow-inner">
                {record.ocr_raw_text}
              </pre>
            </div>
          )}
        </div>

        {/* Right Column: Scanned Image */}
        <div className="space-y-6">
          <div className="rounded-[24px] glass-panel p-6 shadow-sm">
            <h2 className="text-sm font-bold text-[#0f2846] uppercase tracking-wider mb-4">
              Scanned Image
            </h2>
            {imageUrl ? (
              <a 
                href={imageUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border border-[#0f2846]/20 hover:border-[#3a86c6] transition group relative shadow-sm"
              >
                <img
                  src={imageUrl}
                  alt="GR scan"
                  className="w-full h-auto object-contain bg-white/40"
                />
                <div className="absolute inset-0 bg-[#0f2846]/0 group-hover:bg-[#0f2846]/5 transition flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-[#0f2846] text-xs px-4 py-2 rounded-full font-bold shadow-md transition-opacity">
                    View Full Size ↗
                  </span>
                </div>
              </a>
            ) : (
              <div className="rounded-xl border border-dashed border-[#0f2846]/20 bg-white/40 py-12 flex flex-col items-center justify-center text-[#0f2846]/40 shadow-inner">
                <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium">No image attached</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
