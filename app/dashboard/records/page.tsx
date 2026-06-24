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
    if (!profile) return

    async function load() {
      setLoading(true)
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

    load()
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
          <h1 className="text-2xl font-bold text-white">GR Records</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} found
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/records/new"
            id="new-record-btn"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition text-center whitespace-nowrap"
          >
            + New Record
          </Link>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Search Input */}
      {!loading && !error && records.length > 0 && (
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by GR No, Name, or DOB..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800/60 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading records…
        </div>
      )}

      {/* Empty state (No records at all) */}
      {!loading && records.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/30 py-16 text-center">
          <svg className="w-12 h-12 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-gray-500 mb-4">No GR records yet</p>
          {canCreate && (
            <Link
              href="/dashboard/records/new"
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium underline"
            >
              Create your first record →
            </Link>
          )}
        </div>
      )}

      {/* Empty state (Search yielded no results) */}
      {!loading && records.length > 0 && filteredRecords.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-gray-800 bg-gray-900/30 py-16 text-center">
          <p className="text-gray-500">No records found matching "{searchQuery}"</p>
        </div>
      )}

      {/* Records Table */}
      {!loading && filteredRecords.length > 0 && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/40">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">GR No.</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Father</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">DOB</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Admission</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Scan</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredRecords.map((rec) => (
                  <tr 
                    key={rec.id} 
                    onClick={() => router.push(`/dashboard/records/${rec.id}`)}
                    className="hover:bg-gray-800/30 transition cursor-pointer"
                  >
                    <td className="px-4 py-3 text-white font-mono font-medium">
                      {rec.gr_number}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white">{rec.student_name} {rec.surname}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">
                      {rec.fathers_name}
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell font-mono text-xs">
                      {rec.date_of_birth}
                    </td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell font-mono text-xs">
                      {rec.admission_date}
                    </td>
                    <td className="px-4 py-3">
                      {rec.image_url ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-900/40 border border-emerald-700/40 px-2 py-0.5 text-xs text-emerald-400">
                          ✓
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {(profile?.role === 'staff' || profile?.role === 'school_admin') && (
                        <Link
                          href={`/dashboard/records/${rec.id}/edit`}
                          className="text-indigo-400 hover:text-indigo-300 text-xs font-medium"
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
    </div>
  )
}
