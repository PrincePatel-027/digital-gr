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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-[#6b6b6b] mt-1 font-medium">
          Welcome to {profile?.schools?.name || 'Digital GR'}, {profile?.full_name?.split(' ')[0] || 'User'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        <div className="neu-card p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#6b6b6b] mb-2">
            Total Records
          </p>
          <p className="text-3xl sm:text-4xl font-extrabold text-mono">
            {loadingStats ? '—' : stats.total}
          </p>
        </div>

        <div className="neu-card p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#6b6b6b] mb-2">
            This Week
          </p>
          <p className="text-3xl sm:text-4xl font-extrabold text-mono">
            {loadingStats ? '—' : stats.recent}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#6b6b6b] mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(profile?.role === 'staff' || profile?.role === 'school_admin') && (
            <Link
              href="/dashboard/records/new"
              className="neu-card p-5 flex items-center gap-4 hover:border-brutal transition group"
            >
              <div className="w-10 h-10 rounded-lg bg-[#4338ca] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-extrabold">New Record</p>
                <p className="text-xs text-[#6b6b6b]">Scan & add a GR entry</p>
              </div>
            </Link>
          )}

          <Link
            href="/dashboard/records"
            className="neu-card p-5 flex items-center gap-4 hover:border-brutal transition group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#f0ede8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-extrabold">Browse Records</p>
              <p className="text-xs text-[#6b6b6b]">Search & manage all entries</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
