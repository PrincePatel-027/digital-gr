'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth, type Profile } from '@/lib/auth-context'
import { toGujaratiDigits, formatRegisterDate, STANDARDS } from '@/lib/gujarati'

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

interface RecordsLoadResult {
  profile: Profile | null
  reloadVersion: number
  records: GRRecord[]
  error: string | null
}

type StatusFilter = 'all' | 'studying' | 'left'
type SortMode = 'gr-asc' | 'gr-desc' | 'newest'

/** GR numbers are stored as text but read as numbers — sort them numerically. */
function compareGr(a: string, b: string) {
  const na = parseInt(a.replace(/\D/g, ''), 10)
  const nb = parseInt(b.replace(/\D/g, ''), 10)
  if (Number.isNaN(na) || Number.isNaN(nb)) return a.localeCompare(b)
  return na - nb
}

export default function RecordsListPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const searchRef = useRef<HTMLInputElement>(null)

  const [reloadVersion, setReloadVersion] = useState(0)
  const [loadResult, setLoadResult] = useState<RecordsLoadResult>({
    profile: null,
    reloadVersion: -1,
    records: [],
    error: null,
  })

  const resultIsCurrent =
    profile !== null &&
    loadResult.profile === profile &&
    loadResult.reloadVersion === reloadVersion
  const records = loadResult.records
  const loading = !resultIsCurrent
  const error = resultIsCurrent ? loadResult.error : null

  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('q') ?? ''
  })
  const [stdFilter, setStdFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('gr-asc')

  // "/" focuses the lookup box — the action a clerk repeats all day.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const fetchRecords = () => setReloadVersion((version) => version + 1)

  useEffect(() => {
    if (!profile) return

    const activeProfile = profile
    let ignore = false

    async function loadRecords() {
      // RLS already restricts rows to the caller's school. Filtering explicitly as
      // well is defence in depth: if a policy is ever changed or dropped, this query
      // still cannot show another school's records. super_admin has no school_id and
      // is intentionally allowed to see across schools.
      let query = supabase
        .from('gr_records')
        .select('id, gr_number, student_name, surname, fathers_name, date_of_birth, admission_date, admission_standard, leaving_date, image_url, created_at')
      if (activeProfile.school_id) {
        query = query.eq('school_id', activeProfile.school_id)
      }

      const { data, error: fetchErr } = await query.order('created_at', { ascending: false })
      if (ignore) return

      setLoadResult((previous) => ({
        profile: activeProfile,
        reloadVersion,
        records: fetchErr ? previous.records : data ?? [],
        error: fetchErr?.message ?? null,
      }))
    }

    void loadRecords()
    return () => {
      ignore = true
    }
  }, [profile, reloadVersion])

  const canCreate = profile?.role === 'staff' || profile?.role === 'school_admin'
  const canEdit = canCreate

  // Which standards actually appear in this register (don't offer empty filters)
  const presentStandards = useMemo(() => {
    const set = new Set(records.map((r) => (r.admission_standard || '').trim()).filter(Boolean))
    return STANDARDS.filter((s) => set.has(s))
  }, [records])

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const rows = records.filter((rec) => {
      if (stdFilter && (rec.admission_standard || '').trim() !== stdFilter) return false
      if (statusFilter === 'studying' && rec.leaving_date) return false
      if (statusFilter === 'left' && !rec.leaving_date) return false
      if (!q) return true
      return (
        rec.gr_number.toLowerCase().includes(q) ||
        rec.student_name.toLowerCase().includes(q) ||
        rec.fathers_name.toLowerCase().includes(q) ||
        rec.surname.toLowerCase().includes(q) ||
        rec.date_of_birth.toLowerCase().includes(q) ||
        (rec.admission_standard || '').toLowerCase().includes(q)
      )
    })

    const sorted = [...rows]
    if (sortMode === 'gr-asc') sorted.sort((a, b) => compareGr(a.gr_number, b.gr_number))
    else if (sortMode === 'gr-desc') sorted.sort((a, b) => compareGr(b.gr_number, a.gr_number))
    else sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return sorted
  }, [records, searchQuery, stdFilter, statusFilter, sortMode])

  const filtersActive = !!searchQuery || !!stdFilter || statusFilter !== 'all'

  /** Enter in the lookup box jumps straight to an exact GR match. */
  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const q = searchQuery.trim()
    if (!q) return
    const exact = records.find((r) => r.gr_number.toLowerCase() === q.toLowerCase())
    if (exact) router.push(`/dashboard/records/${exact.id}`)
    else if (visible.length === 1) router.push(`/dashboard/records/${visible[0].id}`)
  }

  function clearFilters() {
    setSearchQuery('')
    setStdFilter(null)
    setStatusFilter('all')
  }

  return (
    <div className="space-y-5">
      {/* ══ Register header ═══════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-1.5">
            {profile?.schools?.name || 'All schools'}
          </p>
          <h1 className="font-gujarati-serif text-2xl sm:text-3xl leading-tight">
            રજિસ્ટર અનુક્રમણિકા
          </h1>
          <p className="text-sm text-ink-soft mt-1.5">
            Register index ·{' '}
            <span className="text-mono text-ink font-semibold">{visible.length}</span>{' '}
            {visible.length === 1 ? 'entry' : 'entries'}
            {filtersActive && records.length !== visible.length && (
              <span className="text-ink-faint"> of {records.length}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="neu-btn neu-btn-ghost min-h-[42px] px-4 text-sm"
            title="Print this index"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
            </svg>
            Print
          </button>
          {canCreate && (
            <Link href="/dashboard/records/new" id="new-record-btn" className="neu-btn neu-btn-accent">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New entry
            </Link>
          )}
        </div>
      </div>

      {/* ══ Error ═════════════════════════════════════════════ */}
      {error && (
        <div className="neu-card-flat p-5" style={{ borderColor: '#a8322b' }}>
          <p className="text-sm font-semibold text-error mb-1">Couldn&apos;t open the register</p>
          <p className="text-xs text-ink-soft mb-4">Check your connection and try again.</p>
          <button onClick={fetchRecords} className="neu-btn neu-btn-ghost text-sm min-h-[40px] px-4">
            Retry
          </button>
        </div>
      )}

      {/* ══ Lookup bar ════════════════════════════════════════ */}
      {!error && records.length > 0 && (
        <div className="neu-card p-4 space-y-3.5 no-print">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Jump to a GR number / search */}
            <div className="relative flex-1 min-w-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                ref={searchRef}
                type="text"
                placeholder="GR number, name, father's name or date…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKey}
                className="neu-input pl-9 pr-16"
                aria-label="Look up an entry"
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:block text-[10px] font-semibold text-ink-faint border border-line-strong rounded-sm px-1.5 py-0.5 pointer-events-none">
                /
              </kbd>
            </div>

            {/* Sort — registers are read in GR order by default */}
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="sort" className="label-en shrink-0">Order</label>
              <select
                id="sort"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="neu-input min-h-[42px] py-2 text-sm w-auto"
              >
                <option value="gr-asc">GR number ↑</option>
                <option value="gr-desc">GR number ↓</option>
                <option value="newest">Recently added</option>
              </select>
            </div>
          </div>

          {/* Standard + status filters */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="label-gu font-gujarati-serif mr-1">ધોરણ</span>
            <button
              onClick={() => setStdFilter(null)}
              className={`chip ${stdFilter === null ? 'chip-active' : ''}`}
            >
              All
            </button>
            {presentStandards.map((std) => (
              <button
                key={std}
                onClick={() => setStdFilter(stdFilter === std ? null : std)}
                className={`chip font-gujarati ${stdFilter === std ? 'chip-active' : ''}`}
              >
                {toGujaratiDigits(std)}
              </button>
            ))}

            <span className="w-px h-6 bg-line-strong mx-2 hidden sm:block" />

            {([
              ['all', 'All'],
              ['studying', 'ચાલુ'],
              ['left', 'છોડી ગયા'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`chip ${key !== 'all' ? 'font-gujarati' : ''} ${statusFilter === key ? 'chip-active' : ''}`}
              >
                {label}
              </button>
            ))}

            {filtersActive && (
              <button
                onClick={clearFilters}
                className="ml-auto text-xs font-semibold text-accent hover:underline px-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ Loading ═══════════════════════════════════════════ */}
      {loading && (
        <div className="neu-card p-4 space-y-2.5" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-surface-2 animate-pulse rounded-sm" />
          ))}
        </div>
      )}

      {/* ══ Empty register ════════════════════════════════════ */}
      {!loading && records.length === 0 && !error && (
        <div className="neu-card ruled p-10 sm:p-14 text-center">
          <p className="font-gujarati-serif text-2xl mb-2">રજિસ્ટર ખાલી છે</p>
          <h2 className="text-base font-semibold mb-2">The register has no entries yet</h2>
          <p className="text-sm text-ink-soft max-w-sm mx-auto leading-relaxed">
            Photograph a page of your paper register. The student details are read
            for you, and you confirm them before they&apos;re saved here.
          </p>
          {canCreate && (
            <Link href="/dashboard/records/new" className="neu-btn neu-btn-accent mt-7 inline-flex">
              Add the first entry
            </Link>
          )}
        </div>
      )}

      {/* ══ No matches ════════════════════════════════════════ */}
      {!loading && records.length > 0 && visible.length === 0 && !error && (
        <div className="neu-card p-10 text-center">
          <h2 className="font-display text-xl mb-2">Nothing matches</h2>
          <p className="text-sm text-ink-soft">
            No entry in this register fits the current filters.
          </p>
          <button onClick={clearFilters} className="mt-4 text-sm font-semibold text-accent hover:underline">
            Clear filters
          </button>
        </div>
      )}

      {/* ══ THE LEDGER (desktop) ══════════════════════════════ */}
      {!loading && visible.length > 0 && (
        <div className="record-table-container">
          <div className="neu-card overflow-hidden">
            {/* Printed sheet caption — appears on paper, not on screen */}
            <div className="print-only px-5 py-3 border-b border-line-strong">
              <p className="font-gujarati-serif text-base font-semibold">
                જનરલ રજિસ્ટર — {profile?.schools?.name}
              </p>
              <p className="text-xs">
                {visible.length} entries · printed {formatRegisterDate(new Date().toISOString().slice(0, 10))}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="ledger ledger-sticky">
                <thead>
                  <tr>
                    <th className="col-serial">#</th>
                    <th>રજી. નં<span className="en">GR no</span></th>
                    <th>પુરૂં નામ<span className="en">Full name</span></th>
                    <th>પિતાનું નામ<span className="en">Father</span></th>
                    <th>ધોરણ<span className="en">Std</span></th>
                    <th className="hidden lg:table-cell">જન્મ તારીખ<span className="en">Date of birth</span></th>
                    <th className="hidden xl:table-cell">દાખલ તારીખ<span className="en">Admitted</span></th>
                    <th>સ્થિતિ<span className="en">Status</span></th>
                    <th className="no-print"><span className="en">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((rec, i) => (
                    <tr
                      key={rec.id}
                      onClick={() => router.push(`/dashboard/records/${rec.id}`)}
                      className={`cursor-pointer ${rec.leaving_date ? 'entry-left' : ''}`}
                    >
                      <td className="col-serial">{toGujaratiDigits(i + 1)}</td>
                      <td>
                        <span className={`gr-stamp ${rec.leaving_date ? 'gr-stamp-left' : ''}`}>
                          {rec.gr_number}
                        </span>
                      </td>
                      <td className="font-gujarati font-semibold">
                        {rec.student_name} {rec.surname}
                      </td>
                      <td className="font-gujarati text-sm">{rec.fathers_name}</td>
                      <td className="font-gujarati text-sm">
                        {rec.admission_standard ? toGujaratiDigits(rec.admission_standard) : '—'}
                      </td>
                      <td className="text-mono text-xs hidden lg:table-cell">
                        {formatRegisterDate(rec.date_of_birth) || '—'}
                      </td>
                      <td className="text-mono text-xs hidden xl:table-cell">
                        {formatRegisterDate(rec.admission_date) || '—'}
                      </td>
                      <td>
                        {rec.leaving_date ? (
                          <span className="font-gujarati text-xs font-semibold text-red-ink">
                            છોડી ગયા
                            <span className="block text-mono text-[10px] font-normal">
                              {formatRegisterDate(rec.leaving_date)}
                            </span>
                          </span>
                        ) : (
                          <span className="font-gujarati text-xs font-semibold text-accent">ચાલુ</span>
                        )}
                      </td>
                      <td className="no-print text-right" onClick={(e) => e.stopPropagation()}>
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

      {/* ══ Entry cards (mobile) ══════════════════════════════ */}
      {!loading && visible.length > 0 && (
        <div className="record-cards-container flex-col gap-2.5">
          {visible.map((rec) => (
            <div
              key={rec.id}
              onClick={() => router.push(`/dashboard/records/${rec.id}`)}
              className="neu-card card-interactive p-4 cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span className={`gr-stamp shrink-0 ${rec.leaving_date ? 'gr-stamp-left' : ''}`}>
                  {rec.gr_number}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-gujarati font-semibold text-[15px] truncate">
                    {rec.student_name} {rec.surname}
                  </p>
                  <p className="font-gujarati text-xs text-ink-soft truncate mt-0.5">
                    પિતા: {rec.fathers_name}
                  </p>
                </div>
                {rec.leaving_date ? (
                  <span className="font-gujarati text-[11px] font-semibold text-red-ink shrink-0">છોડી ગયા</span>
                ) : (
                  <span className="font-gujarati text-[11px] font-semibold text-accent shrink-0">ચાલુ</span>
                )}
              </div>

              <dl className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-line text-[11px]">
                <div>
                  <dt className="font-gujarati text-ink-faint">ધોરણ</dt>
                  <dd className="font-gujarati font-semibold mt-0.5">
                    {rec.admission_standard ? toGujaratiDigits(rec.admission_standard) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-gujarati text-ink-faint">જન્મ</dt>
                  <dd className="text-mono mt-0.5">{formatRegisterDate(rec.date_of_birth) || '—'}</dd>
                </div>
                <div>
                  <dt className="font-gujarati text-ink-faint">દાખલ</dt>
                  <dd className="text-mono mt-0.5">{formatRegisterDate(rec.admission_date) || '—'}</dd>
                </div>
              </dl>

              {canEdit && (
                <div className="mt-3 pt-3 border-t border-line flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/dashboard/records/${rec.id}/edit`}
                    className="text-xs font-semibold text-accent px-3 py-1.5 rounded-sm border border-accent/30 hover:border-accent transition-colors min-h-[36px] flex items-center"
                  >
                    Edit entry
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
