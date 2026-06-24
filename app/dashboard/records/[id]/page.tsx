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
      alert(`Failed to delete: ${msg}`)
      setDeleting(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
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
        <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3 text-sm text-red-300">
          {error || 'Record not found'}
        </div>
        <button
          onClick={() => router.push('/dashboard/records')}
          className="text-indigo-400 hover:text-indigo-300 text-sm underline"
        >
          ← Back to records
        </button>
      </div>
    )
  }

  const canEdit = profile?.role === 'staff' || profile?.role === 'school_admin'
  const canDelete = profile?.role === 'school_admin'

  const FieldView = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="border-b border-gray-800/60 pb-3">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-sm text-white font-medium">{value || <span className="text-gray-600 font-normal">—</span>}</dd>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/dashboard/records')}
            className="text-gray-400 hover:text-white text-sm mb-3 flex items-center transition"
          >
            ← Back to records
          </button>
          <h1 className="text-2xl font-bold text-white">
            GR #{record.gr_number} — {record.student_name} {record.surname}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Added on {new Date(record.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canEdit && (
            <Link
              href={`/dashboard/records/${record.id}/edit`}
              className="rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-700 hover:text-white transition"
            >
              Edit Record
            </Link>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-900/50 hover:text-red-300 transition disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Data Fields */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-5">
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
            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Extracted OCR Text
              </h2>
              <pre className="whitespace-pre-wrap text-sm text-gray-400 bg-gray-950/50 rounded-lg p-4 max-h-60 overflow-y-auto font-mono leading-relaxed border border-gray-800">
                {record.ocr_raw_text}
              </pre>
            </div>
          )}
        </div>

        {/* Right Column: Scanned Image */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
              Scanned Image
            </h2>
            {imageUrl ? (
              <a 
                href={imageUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg border border-gray-700 hover:border-indigo-500 transition group relative"
              >
                <img
                  src={imageUrl}
                  alt="GR scan"
                  className="w-full h-auto object-contain bg-gray-950"
                />
                <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-gray-900/80 text-white text-xs px-3 py-1.5 rounded-full font-medium transition-opacity">
                    View Full Size ↗
                  </span>
                </div>
              </a>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/30 py-12 flex flex-col items-center justify-center text-gray-500">
                <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm">No image attached</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
