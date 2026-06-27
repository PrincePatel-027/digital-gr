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
  admission_standard: string | null
  leaving_date: string | null
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
      .select('id, gr_number, student_name, surname, fathers_name, date_of_birth, admission_date, admission_standard, leaving_date, image_url, created_at')
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
      rec.date_of_birth.toLowerCase().includes(q) ||
      (rec.admission_standard || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Records
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-1 font-medium">
            {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/records/new"
            id="new-record-btn"
            className="neu-btn neu-btn-accent text-xs w-full sm:w-auto"
          >
            + New Record
          </Link>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="neu-card-flat p-4 border-red-500" style={{ borderColor: '#dc2626' }}>
          <p className="text-sm font-bold text-red-700 mb-2">Couldn&apos;t load records</p>
          <p className="text-xs text-red-600 mb-3">Check your connection and try again.</p>
          <button onClick={fetchRecords} className="neu-btn neu-btn-ghost text-xs min-h-[36px] px-4">
            Retry
          </button>
        </div>
      )}

      {/* Search */}
      {!loading && !error && records.length > 0 && (
        <div className="relative w-full sm:max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-[#9a9590]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by GR No, Name, DOB, Std…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="neu-input pl-10"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-[#6b6b6b]">
          <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-semibold">Loading records…</span>
        </div>
      )}

      {/* Empty — no records */}
      {!loading && records.length === 0 && !error && (
        <div className="neu-card p-10 text-center">
          <div className="w-14 h-14 rounded-lg bg-[#1a1a1a] flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-[#f0ede8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-lg font-extrabold mb-2">No records yet</h3>
          <p className="text-sm text-[#6b6b6b] max-w-xs mx-auto">
            Upload your first GR register page to get started.
          </p>
          {canCreate && (
            <Link href="/dashboard/records/new" className="neu-btn neu-btn-primary text-xs mt-6 inline-flex">
              + Create First Record
            </Link>
          )}
        </div>
      )}

      {/* Empty — search no results */}
      {!loading && records.length > 0 && filteredRecords.length === 0 && !error && (
        <div className="neu-card p-10 text-center">
          <h3 className="text-base font-extrabold mb-2">No matches</h3>
          <p className="text-sm text-[#6b6b6b]">
            No records match &quot;<span className="font-bold text-[#1a1a1a]">{searchQuery}</span>&quot;
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 text-sm font-bold text-[#4338ca] hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && filteredRecords.length > 0 && (
        <div className="record-table-container">
          <div className="neu-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b-2 border-[#1a1a1a]">
                    <th className="px-5 py-3.5 text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider">GR No.</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider">Student</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider">Father</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider hidden md:table-cell">Std.</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider hidden lg:table-cell">DOB</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider hidden lg:table-cell">Admission</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d4d0c8]">
                  {filteredRecords.map((rec) => (
                    <tr
                      key={rec.id}
                      onClick={() => router.push(`/dashboard/records/${rec.id}`)}
                      className="hover:bg-black/[0.02] transition cursor-pointer"
                    >
                      <td className="px-5 py-3.5 text-mono font-bold text-sm">{rec.gr_number}</td>
                      <td className="px-5 py-3.5 font-bold">{rec.student_name} {rec.surname}</td>
                      <td className="px-5 py-3.5 text-[#6b6b6b]">{rec.fathers_name}</td>
                      <td className="px-5 py-3.5 text-mono text-xs text-[#6b6b6b] hidden md:table-cell">
                        {rec.admission_standard ? `ધો. ${rec.admission_standard}` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-mono text-xs text-[#6b6b6b] hidden lg:table-cell">{rec.date_of_birth}</td>
                      <td className="px-5 py-3.5 text-mono text-xs text-[#6b6b6b] hidden lg:table-cell">{rec.admission_date}</td>
                      <td className="px-5 py-3.5">
                        {rec.leaving_date ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[#d97706]">
                            <span className="w-2 h-2 rounded-full bg-[#d97706]" />
                            Left
                          </span>
                        ) : rec.image_url ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[#16a34a]">
                            <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
                            Active
                          </span>
                        ) : (
                          <span className="text-[#9a9590] text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        {(profile?.role === 'staff' || profile?.role === 'school_admin') && (
                          <Link
                            href={`/dashboard/records/${rec.id}/edit`}
                            className="text-xs font-bold text-[#4338ca] hover:underline"
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
        </div>
      )}

      {/* Mobile Cards */}
      {!loading && filteredRecords.length > 0 && (
        <div className="record-cards-container flex-col gap-3">
          {filteredRecords.map((rec) => (
            <div
              key={rec.id}
              onClick={() => router.push(`/dashboard/records/${rec.id}`)}
              className="neu-card p-4 active:scale-[0.99] transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* GR badge + status */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-mono font-bold text-white bg-[#1a1a1a] px-2 py-1 rounded-md">
                      GR-{rec.gr_number}
                    </span>
                    {rec.admission_standard && (
                      <span className="text-[10px] text-mono font-bold text-[#6b6b6b] bg-[#e8e4de] px-2 py-1 rounded-md">
                        ધો. {rec.admission_standard}
                      </span>
                    )}
                    {rec.leaving_date ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#d97706]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
                        Left
                      </span>
                    ) : rec.image_url ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16a34a]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                        Active
                      </span>
                    ) : null}
                  </div>

                  {/* Name */}
                  <p className="text-sm font-extrabold truncate">
                    {rec.student_name} {rec.surname}
                  </p>

                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-[#6b6b6b]">
                    <span>Father: <span className="text-[#1a1a1a] font-semibold">{rec.fathers_name}</span></span>
                    <span>DOB: <span className="text-mono text-[#1a1a1a]">{rec.date_of_birth}</span></span>
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-[#d4d0c8] flex-shrink-0 mt-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Edit */}
              {(profile?.role === 'staff' || profile?.role === 'school_admin') && (
                <div className="mt-3 pt-3 border-t border-[#d4d0c8] flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/dashboard/records/${rec.id}/edit`}
                    className="text-xs font-bold text-[#4338ca] px-3 py-1.5 rounded-md border-2 border-[#4338ca]/20 hover:border-[#4338ca] transition min-h-[36px] flex items-center"
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
