'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface GRRecord {
  id: string
  gr_number: string
  student_name: string
  surname: string
  fathers_name: string
  date_of_birth: string
  admission_date: string
  image_url: string | null
  created_at: string
}

export default function RecordsListPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [records, setRecords] = useState<GRRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    // Read initial search query from URL (e.g. from Dashboard Home)
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    if (q) setSearchQuery(q)
  }, [])

  const fetchRecords = async () => {
    if (!profile) return

    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await supabase
      .from('gr_records')
      .select('id, gr_number, student_name, surname, fathers_name, date_of_birth, admission_date, image_url, created_at')
      .order('created_at', { ascending: false })

    if (fetchErr) {
      setError(fetchErr.message)
    } else {
      setRecords(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!profile) return
    fetchRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const canCreate = profile?.role === 'staff' || profile?.role === 'school_admin'

  const filteredRecords = records.filter((rec) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      rec.gr_number.toLowerCase().includes(q) ||
      rec.student_name.toLowerCase().includes(q) ||
      rec.fathers_name.toLowerCase().includes(q) ||
      rec.surname.toLowerCase().includes(q) ||
      rec.date_of_birth.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0f2846]">GR Records</h1>
          <p className="text-[#0f2846]/70 mt-1 text-sm font-medium">
            {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} found
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/records/new"
            id="new-record-btn"
            className="rounded-xl bg-[#3a86c6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3a86c6]/90 shadow-md transition text-center whitespace-nowrap min-h-[44px] flex items-center justify-center"
          >
            + New Record
          </Link>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50/80 border border-red-200 px-4 py-4 space-y-3 shadow-sm">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">
                We couldn't load your records right now
              </p>
              <p className="text-xs text-red-600 mt-1">
                This might be a temporary issue — please check your internet connection and try again.
              </p>
            </div>
          </div>
          <button
            onClick={fetchRecords}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition min-h-[44px]"
          >
            Try again
          </button>
        </div>
      )}

      {/* Search Input */}
      {!loading && !error && records.length > 0 && (
        <div className="relative w-full sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-[#0f2846]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by GR No, Name, or DOB..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl glass-input pl-10 pr-4 py-2.5 text-sm placeholder-[#0f2846]/40 transition min-h-[44px]"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-[#0f2846]/60">
          <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading records…
        </div>
      )}

      {/* Empty state (No records at all) */}
      {!loading && records.length === 0 && !error && (
        <div className="rounded-[24px] glass-panel border-dashed py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-[24px] bg-white/50 border border-white/60 shadow-sm flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-[#3a86c6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[#0f2846] mb-2">No records have been digitized yet</h3>
          <p className="text-sm text-[#0f2846]/70 max-w-sm mx-auto">
            Upload your first GR register page to get started. You can photograph or scan the page and we'll help extract the text.
          </p>
          {canCreate && (
            <Link
              href="/dashboard/records/new"
              className="inline-flex items-center justify-center mt-6 rounded-xl bg-[#3a86c6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3a86c6]/90 shadow-md transition min-h-[44px]"
            >
              + Create your first record
            </Link>
          )}
        </div>
      )}

      {/* Empty state (Search yielded no results) */}
      {!loading && records.length > 0 && filteredRecords.length === 0 && !error && (
        <div className="rounded-[24px] glass-panel border-dashed py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-white/50 border border-white/60 shadow-sm flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#0f2846]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-[#0f2846] mb-1">No matching records</h3>
          <p className="text-sm text-[#0f2846]/70 max-w-sm mx-auto">
            We couldn't find any records matching "<span className="text-[#0f2846] font-medium">{searchQuery}</span>". Try a different name, GR number, or date.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 text-sm font-semibold text-[#3a86c6] hover:text-[#0f2846] underline transition"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Records — Desktop Table (md and up) */}
      {!loading && filteredRecords.length > 0 && (
        <div className="hidden md:block rounded-[24px] glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/40 bg-white/40">
                  <th className="px-6 py-4 text-xs font-semibold text-[#0f2846]/60 uppercase tracking-wider">GR No.</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#0f2846]/60 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#0f2846]/60 uppercase tracking-wider">Father</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#0f2846]/60 uppercase tracking-wider hidden lg:table-cell">DOB</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#0f2846]/60 uppercase tracking-wider hidden lg:table-cell">Admission</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#0f2846]/60 uppercase tracking-wider">Scan</th>
                  <th className="px-6 py-4 text-xs font-semibold text-[#0f2846]/60 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/40">
                {filteredRecords.map((rec) => (
                  <tr 
                    key={rec.id} 
                    onClick={() => router.push(`/dashboard/records/${rec.id}`)}
                    className="hover:bg-white/40 transition cursor-pointer"
                  >
                    <td className="px-6 py-4 text-[#0f2846] font-mono font-bold">
                      {rec.gr_number}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[#0f2846] font-medium">{rec.student_name} {rec.surname}</p>
                    </td>
                    <td className="px-6 py-4 text-[#0f2846]/80 font-medium">
                      {rec.fathers_name}
                    </td>
                    <td className="px-6 py-4 text-[#0f2846]/80 hidden lg:table-cell font-mono text-xs font-medium">
                      {rec.date_of_birth}
                    </td>
                    <td className="px-6 py-4 text-[#0f2846]/80 hidden lg:table-cell font-mono text-xs font-medium">
                      {rec.admission_date}
                    </td>
                    <td className="px-6 py-4">
                      {rec.image_url ? (
                        <span className="inline-flex items-center rounded-full bg-[#6b9e78] px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                          ✓
                        </span>
                      ) : (
                        <span className="text-[#0f2846]/40 text-xs font-bold">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      {(profile?.role === 'staff' || profile?.role === 'school_admin') && (
                        <Link
                          href={`/dashboard/records/${rec.id}/edit`}
                          className="text-[#3a86c6] hover:text-[#0f2846] text-xs font-bold"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Records — Mobile Card Layout (below md) */}
      {!loading && filteredRecords.length > 0 && (
        <div className="md:hidden space-y-4">
          {filteredRecords.map((rec) => (
            <div
              key={rec.id}
              onClick={() => router.push(`/dashboard/records/${rec.id}`)}
              className="rounded-2xl glass-panel p-5 hover:bg-white/40 transition cursor-pointer active:bg-white/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* GR Number */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-white bg-[#0f2846] px-2.5 py-1 rounded-md shadow-sm">
                      GR-{rec.gr_number}
                    </span>
                    {rec.image_url ? (
                      <span className="inline-flex items-center rounded-full bg-[#6b9e78] px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                        ✓ Scan
                      </span>
                    ) : null}
                  </div>

                  {/* Student name */}
                  <p className="text-base font-bold text-[#0f2846] truncate">
                    {rec.student_name} {rec.surname}
                  </p>

                  {/* Father's name + DOB */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[#0f2846]/70">
                    <span className="font-medium">Father: <span className="text-[#0f2846]">{rec.fathers_name}</span></span>
                    <span className="font-medium">DOB: <span className="text-[#0f2846] font-mono">{rec.date_of_birth}</span></span>
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-5 h-5 text-[#0f2846]/30 flex-shrink-0 mt-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Actions row */}
              {(profile?.role === 'staff' || profile?.role === 'school_admin') && (
                <div className="mt-4 pt-4 border-t border-white/40 flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/dashboard/records/${rec.id}/edit`}
                    className="text-[#3a86c6] hover:text-[#0f2846] text-xs font-bold px-4 py-2 rounded-lg border border-[#3a86c6]/30 hover:bg-white/50 transition min-h-[36px] flex items-center bg-white/40 shadow-sm"
                  >
                    Edit
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
