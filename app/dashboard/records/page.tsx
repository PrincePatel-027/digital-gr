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

function StatusPill({ rec }: { rec: GRRecord }) {
  if (rec.leaving_date) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-warning">
        <span className="w-1.5 h-1.5 rounded-full bg-warning" />
        Left
      </span>
    )
  }
  if (rec.image_url) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Active
      </span>
    )
  }
  return <span className="text-ink-faint text-xs">—</span>
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
  const canEdit = canCreate

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
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">Records</h1>
          <p className="text-sm text-ink-soft mt-2">
            {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
            {searchQuery && records.length !== filteredRecords.length ? ` of ${records.length}` : ''}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/records/new"
            id="new-record-btn"
            className="neu-btn neu-btn-accent w-full sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New record
          </Link>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="neu-card-flat p-5" style={{ borderColor: '#dc2626' }}>
          <p className="text-sm font-semibold text-error mb-1">Couldn&apos;t load records</p>
          <p className="text-xs text-ink-soft mb-4">Check your connection and try again.</p>
          <button onClick={fetchRecords} className="neu-btn neu-btn-ghost text-sm min-h-[40px] px-4">
            Retry
          </button>
        </div>
      )}

      {/* Search */}
      {!loading && !error && records.length > 0 && (
        <div className="relative w-full sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by GR no, name, DOB, standard…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="neu-input pl-10"
            aria-label="Search records"
          />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="neu-card p-4 flex items-center gap-4">
              <div className="h-6 w-16 rounded-md bg-surface-2 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-surface-2 animate-pulse" />
                <div className="h-3 w-24 rounded bg-surface-2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty — no records */}
      {!loading && records.length === 0 && !error && (
        <div className="neu-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-ink flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-paper" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl mb-2">No records yet</h2>
          <p className="text-sm text-ink-soft max-w-xs mx-auto">
            Upload your first register page and the details will appear here.
          </p>
          {canCreate && (
            <Link href="/dashboard/records/new" className="neu-btn neu-btn-primary mt-6 inline-flex">
              Create first record
            </Link>
          )}
        </div>
      )}

      {/* Empty — search no results */}
      {!loading && records.length > 0 && filteredRecords.length === 0 && !error && (
        <div className="neu-card p-12 text-center">
          <h2 className="font-display text-xl mb-2">No matches</h2>
          <p className="text-sm text-ink-soft">
            Nothing matches &ldquo;<span className="font-semibold text-ink">{searchQuery}</span>&rdquo;
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 text-sm font-semibold text-accent hover:underline"
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
                  <tr className="border-b border-line-strong">
                    {['GR no.', 'Student', 'Father', 'Std.', 'DOB', 'Admission', 'Status', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-5 py-3.5 text-[11px] font-semibold text-ink-faint tracking-wide ${
                          i === 3 ? 'hidden md:table-cell' : ''
                        } ${i === 4 || i === 5 ? 'hidden lg:table-cell' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredRecords.map((rec) => (
                    <tr
                      key={rec.id}
                      onClick={() => router.push(`/dashboard/records/${rec.id}`)}
                      className="hover:bg-ink/[0.03] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 text-mono font-semibold">{rec.gr_number}</td>
                      <td className="px-5 py-4 font-semibold">{rec.student_name} {rec.surname}</td>
                      <td className="px-5 py-4 text-ink-soft">{rec.fathers_name}</td>
                      <td className="px-5 py-4 text-mono text-xs text-ink-soft hidden md:table-cell">
                        {rec.admission_standard ? <span className="font-gujarati">ધો. {rec.admission_standard}</span> : '—'}
                      </td>
                      <td className="px-5 py-4 text-mono text-xs text-ink-soft hidden lg:table-cell">{rec.date_of_birth}</td>
                      <td className="px-5 py-4 text-mono text-xs text-ink-soft hidden lg:table-cell">{rec.admission_date}</td>
                      <td className="px-5 py-4"><StatusPill rec={rec} /></td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <Link
                            href={`/dashboard/records/${rec.id}/edit`}
                            className="text-xs font-semibold text-accent hover:underline"
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
              className="neu-card card-interactive p-4 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-mono font-semibold text-paper bg-ink px-2 py-0.5 rounded-md">
                      GR-{rec.gr_number}
                    </span>
                    {rec.admission_standard && (
                      <span className="text-[11px] text-mono font-semibold text-ink-soft bg-surface-2 px-2 py-0.5 rounded-md font-gujarati">
                        ધો. {rec.admission_standard}
                      </span>
                    )}
                    <StatusPill rec={rec} />
                  </div>
                  <p className="text-[15px] font-semibold truncate">
                    {rec.student_name} {rec.surname}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-ink-soft">
                    <span>Father: <span className="text-ink font-medium">{rec.fathers_name}</span></span>
                    <span>DOB: <span className="text-mono text-ink">{rec.date_of_birth}</span></span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-ink-faint shrink-0 mt-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {canEdit && (
                <div className="mt-3 pt-3 border-t border-line flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/dashboard/records/${rec.id}/edit`}
                    className="text-xs font-semibold text-accent px-3 py-1.5 rounded-lg border border-accent/25 hover:border-accent transition-colors min-h-[36px] flex items-center"
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
