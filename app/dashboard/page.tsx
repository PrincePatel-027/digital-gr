'use client'

import { useAuth } from '@/lib/auth-context'

export default function DashboardPage() {
  const { profile } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
      <p className="text-gray-400">
        Welcome back, <span className="text-white font-medium">{profile?.full_name}</span>.
      </p>

      {/* Debug info — useful during Phase 3 testing, remove later */}
      <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900/50 p-4 max-w-md">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Session Debug</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Role</dt>
            <dd className="text-white font-mono">{profile?.role ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">School ID</dt>
            <dd className="text-white font-mono text-xs">{profile?.school_id ?? 'null (super_admin)'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">User ID</dt>
            <dd className="text-white font-mono text-xs truncate max-w-[200px]">{profile?.id ?? '—'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
