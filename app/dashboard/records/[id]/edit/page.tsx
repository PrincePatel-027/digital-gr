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
          gr_number: data.gr_number || '',
          student_name: data.student_name || '',
          fathers_name: data.fathers_name || '',
          mothers_name: data.mothers_name || '',
          surname: data.surname || '',
          date_of_birth: data.date_of_birth || '',
          admission_date: data.admission_date || '',
          address: data.address || '',
          caste_category: data.caste_category || '',
          previous_school: data.previous_school || '',
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
      <div className="flex items-center justify-center py-20 text-gray-400">
        <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading record…
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3 text-sm text-red-300">
          {error}
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

  if (!record) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Edit Record — GR #{record.gr_number}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Update the student details below.
        </p>
      </div>

      <GRRecordForm mode="edit" initialData={record} />
    </div>
  )
}
