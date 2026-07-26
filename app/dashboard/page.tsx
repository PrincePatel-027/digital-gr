'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ total: 0, recent: 0 })
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    async function loadStats() {
      if (!profile?.school_id) { setLoadingStats(false); return }

      const { count: total } = await supabase
        .from('gr_records')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', profile.school_id)

      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const { count: recent } = await supabase
        .from('gr_records')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', profile.school_id)
        .gte('created_at', weekAgo.toISOString())

      setStats({ total: total || 0, recent: recent || 0 })
      setLoadingStats(false)
    }
    loadStats()
  }, [profile])

  const canCreate = profile?.role === 'staff' || profile?.role === 'school_admin'
  const isSuperAdmin = profile?.role === 'super_admin'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="animate-fade-up" style={{ animationDelay: '40ms' }}>
        <p className="text-sm text-ink-soft mb-1">
          Welcome back, {firstName}
        </p>
        <h1 className="text-4xl sm:text-5xl">
          {profile?.schools?.name || (isSuperAdmin ? 'All schools' : 'Dashboard')}
        </h1>

        {/* Make the tenancy explicit: this login only ever sees this school. */}
        {profile?.schools?.name ? (
          <p className="mt-4 inline-flex items-start gap-2 text-xs text-ink-soft rounded-xl border border-line bg-surface px-3.5 py-2.5">
            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span>
              This register belongs to <span className="font-semibold text-ink">{profile.schools.name}</span>.
              Only your school&apos;s staff can see these records.
            </span>
          </p>
        ) : isSuperAdmin ? (
          <p className="mt-4 text-sm text-ink-soft">
            You&apos;re signed in as super admin — manage schools and their administrators.
          </p>
        ) : null}
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 sm:gap-5">
        {[
          { label: 'Total records', value: stats.total, hint: 'in the register' },
          { label: 'Added this week', value: stats.recent, hint: 'last 7 days' },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="neu-card p-5 sm:p-7 animate-fade-up"
            style={{ animationDelay: `${100 + i * 70}ms` }}
          >
            <p className="text-xs font-semibold text-ink-soft mb-3">{stat.label}</p>
            {loadingStats ? (
              <div className="h-11 w-20 rounded-lg bg-surface-2 animate-pulse" />
            ) : (
              <p className="text-mono text-4xl sm:text-5xl font-semibold leading-none tracking-tight">
                {stat.value}
              </p>
            )}
            <p className="text-xs text-ink-faint mt-2.5">{stat.hint}</p>
          </div>
        ))}
      </section>

      {/* Quick Actions */}
      <section className="animate-fade-up" style={{ animationDelay: '260ms' }}>
        <h2 className="text-sm font-semibold text-ink-soft mb-4">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {canCreate && (
            <Link
              href="/dashboard/records/new"
              className="neu-card card-interactive p-5 flex items-center gap-4"
            >
              <span className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold">New record</span>
                <span className="block text-xs text-ink-soft mt-0.5">Scan and add a GR entry</span>
              </span>
              <svg className="w-4 h-4 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          <Link
            href="/dashboard/records"
            className="neu-card card-interactive p-5 flex items-center gap-4"
          >
            <span className="w-11 h-11 rounded-xl bg-ink flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-paper" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Browse records</span>
              <span className="block text-xs text-ink-soft mt-0.5">Search and manage all entries</span>
            </span>
            <svg className="w-4 h-4 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  )
}
