'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import GRRecordForm, { type GRRecordData } from '@/components/GRRecordForm'

export default function EditRecordPage() {
  const router = useRouter()
  const params = useParams()
  const { profile, loading: authLoading } = useAuth()

  const [record, setRecord] = useState<GRRecordData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recordId = params.id as string

  // Role check: principals cannot edit
  useEffect(() => {
    if (authLoading) return
    if (profile?.role === 'principal') {
      router.push('/dashboard/records')
    }
  }, [authLoading, profile, router])

  // Load record data
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
        setRecord({
          id: data.id,
          // Left page — મુખ્ય વિગતો
          gr_number: data.gr_number || '',
          student_name: data.student_name || '',
          fathers_name: data.fathers_name || '',
          mothers_name: data.mothers_name || '',
          surname: data.surname || '',
          religion: data.religion || '',
          caste_category: data.caste_category || '',
          date_of_birth: data.date_of_birth || '',
          dob_in_words: data.dob_in_words || '',
          birth_place: data.birth_place || '',
          address: data.address || '',
          previous_school: data.previous_school || '',
          // Right page — શૈક્ષણિક વિગતો
          admission_date: data.admission_date || '',
          admission_standard: data.admission_standard || '',
          progress_and_conduct: data.progress_and_conduct || '',
          leaving_date: data.leaving_date || '',
          leaving_reason: data.leaving_reason || '',
          leaving_standard: data.leaving_standard || '',
          remarks: data.remarks || '',
          // System
          image_url: data.image_url || '',
          ocr_raw_text: data.ocr_raw_text || '',
        })
      }
      setLoading(false)
    }

    loadRecord()
  }, [recordId, profile])

  // Don't render for principals
  if (profile?.role === 'principal') return null

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#6b6b6b]">
        <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-semibold">Loading record…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="neu-card-flat p-5" style={{ borderColor: '#dc2626' }}>
          <p className="text-sm font-bold text-red-700">{error}</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/records')}
          className="text-sm font-bold text-[#4338ca] hover:underline min-h-[44px]"
        >
          ← Back to records
        </button>
      </div>
    )
  }

  if (!record) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Edit Record — GR #{record.gr_number}
        </h1>
        <p className="text-sm text-[#6b6b6b] mt-1 font-medium">
          Update the student details below.
        </p>
      </div>

      <GRRecordForm mode="edit" initialData={record} />
    </div>
  )
}
