'use client'

import { useAuth } from '@/lib/auth-context'

export default function DashboardPage() {
  const { profile } = useAuth()

  if (!profile) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Welcome back, {profile.full_name}.
        </p>
      </div>

      {/* Debug info — useful during development, remove later */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Session Info
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-4">
            <p className="text-gray-500 text-xs mb-1">Role</p>
            <p className="text-white font-medium">{profile.role}</p>
          </div>
          <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-4">
            <p className="text-gray-500 text-xs mb-1">School ID</p>
            <p className="text-white font-mono text-xs break-all">
              {profile.school_id ?? '—  (super admin)'}
            </p>
          </div>
          <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-4">
            <p className="text-gray-500 text-xs mb-1">User ID</p>
            <p className="text-white font-mono text-xs break-all">
              {profile.id}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
