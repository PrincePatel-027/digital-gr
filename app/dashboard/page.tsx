'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface RecentRecord {
  id: string
  gr_number: string
  student_name: string
  surname: string
  created_at: string
}

export default function DashboardHome() {
  const router = useRouter()
  const { profile } = useAuth()
  
  const [totalRecords, setTotalRecords] = useState<number | null>(null)
  const [recentRecords, setRecentRecords] = useState<RecentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!profile) return

    async function loadDashboardData() {
      setLoading(true)

      // Fetch total count
      const { count } = await supabase
        .from('gr_records')
        .select('*', { count: 'exact', head: true })

      setTotalRecords(count)

      // Fetch 5 most recent records
      const { data } = await supabase
        .from('gr_records')
        .select('id, gr_number, student_name, surname, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentRecords(data || [])
      setLoading(false)
    }

    loadDashboardData()
  }, [profile])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/dashboard/records?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  if (!profile) return null

  // Super admins don't manage records directly, they manage schools.
  if (profile.role === 'super_admin') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Welcome back, {profile.full_name.split(' ')[0]}!
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            You are logged in as a Super Admin.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          <p className="text-gray-300">
            Please use the <Link href="/dashboard/schools" className="text-indigo-400 underline hover:text-indigo-300">Schools</Link> tab to manage the platform.
          </p>
        </div>
      </div>
    )
  }

  const canCreate = profile.role === 'staff' || profile.role === 'school_admin'

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Welcome back, {profile.full_name.split(' ')[0]}!
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          Manage your school's digitized General Register (GR) records securely.
        </p>
      </div>

      {/* Main Actions / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Total Records Stat Card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 flex flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Total Records</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-white mt-1">
                  {loading ? '—' : totalRecords}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Global Search Box */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Quick Search</p>
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by GR Number, Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800/60 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-gray-800 border border-gray-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 hover:border-gray-600 transition cursor-pointer"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 mb-4">
        <h2 className="text-lg font-semibold text-white tracking-tight">Recently Added Records</h2>
        {canCreate && (
          <Link
            href="/dashboard/records/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition cursor-pointer"
          >
            + Add New Record
          </Link>
        )}
      </div>

      {/* Recent Records List */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading recent records…
          </div>
        ) : recentRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No records added yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-800/60">
            {recentRecords.map((rec) => (
              <li key={rec.id}>
                <Link
                  href={`/dashboard/records/${rec.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-800/40 transition group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <span className="text-sm font-mono font-medium text-white min-w-[80px]">
                      GR-{rec.gr_number}
                    </span>
                    <span className="text-sm text-gray-300">
                      {rec.student_name} {rec.surname}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="hidden sm:inline">
                      {new Date(rec.created_at).toLocaleDateString()}
                    </span>
                    <svg className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && recentRecords.length > 0 && (
        <div className="text-center mt-4 pb-4">
          <Link
            href="/dashboard/records"
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition underline"
          >
            View all records →
          </Link>
        </div>
      )}
    </div>
  )
}
