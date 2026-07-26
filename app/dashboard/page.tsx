'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { toGujaratiDigits, formatRegisterDate, STANDARDS } from '@/lib/gujarati'

interface RecentEntry {
  id: string
  gr_number: string
  student_name: string
  surname: string
  admission_standard: string | null
  leaving_date: string | null
  created_at: string
}

export default function DashboardPage() {
  const { profile } = useAuth()

  const [total, setTotal] = useState(0)
  const [studying, setStudying] = useState(0)
  const [left, setLeft] = useState(0)
  const [thisWeek, setThisWeek] = useState(0)
  const [byStandard, setByStandard] = useState<Record<string, number>>({})
  const [recent, setRecent] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!profile) return
      if (!profile.school_id) { setLoading(false); return }

      // One pass over the school's register gives every figure on this page.
      const { data } = await supabase
        .from('gr_records')
        .select('id, gr_number, student_name, surname, admission_standard, leaving_date, created_at')
        .eq('school_id', profile.school_id)
        .order('created_at', { ascending: false })

      const rows = data || []
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const standards: Record<string, number> = {}
      let studyingCount = 0
      let leftCount = 0

      for (const r of rows) {
        if (r.leaving_date) leftCount++
        else studyingCount++
        const std = (r.admission_standard || '').trim()
        if (std) standards[std] = (standards[std] || 0) + 1
      }

      setTotal(rows.length)
      setStudying(studyingCount)
      setLeft(leftCount)
      setThisWeek(rows.filter((r) => new Date(r.created_at) >= weekAgo).length)
      setByStandard(standards)
      setRecent(rows.slice(0, 6))
      setLoading(false)
    }
    load()
  }, [profile])

  const canCreate = profile?.role === 'staff' || profile?.role === 'school_admin'
  const isSuperAdmin = profile?.role === 'super_admin'
  const schoolName = profile?.schools?.name
  const maxStd = Math.max(1, ...Object.values(byStandard))

  return (
    <div className="space-y-7">
      {/* ══ Register cover block ══════════════════════════════ */}
      <section className="neu-card overflow-hidden animate-fade-up">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6 p-6 sm:p-8">
          <div className="min-w-0">
            <p className="eyebrow mb-2.5">
              {isSuperAdmin ? 'All schools' : 'Patrak 4 & 5 · Primary register'}
            </p>
            <h1 className="font-gujarati-serif text-3xl sm:text-4xl leading-tight mb-2">
              જનરલ રજિસ્ટર
            </h1>
            <p className="text-lg font-semibold text-ink">
              {schoolName || (isSuperAdmin ? 'Every school on the system' : 'General Register')}
            </p>
            {schoolName && (
              <p className="text-xs text-ink-soft mt-3 max-w-md leading-relaxed">
                This book holds only {schoolName}&apos;s entries. Staff at other
                schools cannot open it.
              </p>
            )}
          </div>

          {/* The school's mark, as stamped on a real register */}
          {schoolName && (
            <div className="stamp-seal shrink-0" aria-hidden="true">
              <div className="px-2">
                <div className="text-[9px] font-semibold leading-tight">શાળા</div>
                <div className="text-[15px] font-bold leading-none my-0.5">GR</div>
                <div className="text-[8px] leading-tight">રજિસ્ટર</div>
              </div>
            </div>
          )}
        </div>

        {/* Ledger figures — read like a register summary line */}
        <dl className="grid grid-cols-2 lg:grid-cols-4 border-t border-line-strong divide-x divide-line">
          {[
            { gu: 'કુલ નોંધ', en: 'Total entries', value: total, tone: 'ink' },
            { gu: 'ચાલુ', en: 'Studying', value: studying, tone: 'accent' },
            { gu: 'છોડી ગયા', en: 'Left school', value: left, tone: 'red' },
            { gu: 'આ અઠવાડિયે', en: 'Added this week', value: thisWeek, tone: 'ink' },
          ].map((f, i) => (
            <div
              key={f.en}
              className={`p-5 sm:p-6 ${i >= 2 ? 'border-t lg:border-t-0 border-line' : ''}`}
            >
              <dt>
                <span className="label-gu font-gujarati-serif">{f.gu}</span>
                <span className="label-en">{f.en}</span>
              </dt>
              <dd className="mt-2.5">
                {loading ? (
                  <span className="block h-9 w-14 bg-surface-2 animate-pulse rounded-sm" />
                ) : (
                  <span
                    className={`text-mono text-3xl sm:text-4xl font-semibold leading-none ${
                      f.tone === 'accent' ? 'text-accent' : f.tone === 'red' ? 'text-red-ink' : 'text-ink'
                    }`}
                  >
                    {f.value}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Super admins have no register of their own */}
      {isSuperAdmin && (
        <section className="neu-card p-6">
          <p className="text-sm text-ink-soft">
            You&apos;re signed in as super admin. Open{' '}
            <Link href="/dashboard/schools" className="font-semibold text-accent hover:underline">
              Schools
            </Link>{' '}
            to add a school or provision its administrator.
          </p>
        </section>
      )}

      {!isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
          {/* ══ Recent entries, as ledger rows ═════════════════ */}
          <section className="neu-card overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line-strong bg-surface-2">
              <div>
                <h2 className="font-gujarati-serif text-sm font-semibold">તાજી નોંધ</h2>
                <p className="label-en">Latest entries</p>
              </div>
              <Link
                href="/dashboard/records"
                className="text-xs font-semibold text-accent hover:underline shrink-0"
              >
                Open register →
              </Link>
            </header>

            {loading ? (
              <div className="p-5 space-y-3" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-9 bg-surface-2 animate-pulse rounded-sm" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="ruled p-8 text-center">
                <p className="font-gujarati-serif text-base mb-1">રજિસ્ટર ખાલી છે</p>
                <p className="text-sm text-ink-soft mb-5">
                  The register is empty. Scan your first page to begin.
                </p>
                {canCreate && (
                  <Link href="/dashboard/records/new" className="neu-btn neu-btn-accent inline-flex">
                    Add first entry
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th className="col-serial">#</th>
                      <th>
                        રજી. નં<span className="en">GR no</span>
                      </th>
                      <th>
                        પુરૂં નામ<span className="en">Name</span>
                      </th>
                      <th>
                        ધોરણ<span className="en">Std</span>
                      </th>
                      <th>
                        સ્થિતિ<span className="en">Status</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r, i) => (
                      <tr key={r.id} className={r.leaving_date ? 'entry-left' : ''}>
                        <td className="col-serial">{toGujaratiDigits(i + 1)}</td>
                        <td>
                          <Link href={`/dashboard/records/${r.id}`} className="hover:underline">
                            <span className={`gr-stamp ${r.leaving_date ? 'gr-stamp-left' : ''}`}>
                              {r.gr_number}
                            </span>
                          </Link>
                        </td>
                        <td>
                          <Link
                            href={`/dashboard/records/${r.id}`}
                            className="font-gujarati font-medium hover:underline"
                          >
                            {r.student_name} {r.surname}
                          </Link>
                        </td>
                        <td className="font-gujarati text-sm">
                          {r.admission_standard ? toGujaratiDigits(r.admission_standard) : '—'}
                        </td>
                        <td className="text-xs font-semibold font-gujarati">
                          {r.leaving_date ? 'છોડી ગયા' : 'ચાલુ'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ══ Side column: action + standard-wise tally ══════ */}
          <div className="space-y-5">
            {canCreate && (
              <section className="neu-card p-5">
                <h2 className="font-gujarati-serif text-sm font-semibold mb-1">નવી નોંધ</h2>
                <p className="text-xs text-ink-soft mb-4 leading-relaxed">
                  Photograph a register page — the fields fill themselves, then you
                  confirm them.
                </p>
                <Link href="/dashboard/records/new" className="neu-btn neu-btn-accent w-full">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  Scan a page
                </Link>
              </section>
            )}

            <section className="neu-card p-5">
              <h2 className="font-gujarati-serif text-sm font-semibold mb-0.5">ધોરણ પ્રમાણે</h2>
              <p className="label-en mb-4">Entries per standard</p>

              {loading ? (
                <div className="space-y-2.5" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-5 bg-surface-2 animate-pulse rounded-sm" />
                  ))}
                </div>
              ) : total === 0 ? (
                <p className="text-xs text-ink-faint">No entries yet.</p>
              ) : (
                <ul className="space-y-2">
                  {STANDARDS.map((std) => {
                    const count = byStandard[std] || 0
                    return (
                      <li key={std} className="flex items-center gap-3">
                        <span className="font-gujarati text-sm font-semibold w-7 text-ink-soft tabular-nums">
                          {toGujaratiDigits(std)}
                        </span>
                        <span className="flex-1 h-4 bg-surface-2 rounded-sm overflow-hidden">
                          <span
                            className="block h-full bg-accent/70"
                            style={{ width: count ? `${Math.max(6, (count / maxStd) * 100)}%` : '0%' }}
                          />
                        </span>
                        <span className="text-mono text-xs text-ink-soft w-7 text-right">{count}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {recent[0] && (
              <p className="text-[11px] text-ink-faint px-1">
                Last entry added {formatRegisterDate(recent[0].created_at.slice(0, 10))}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
