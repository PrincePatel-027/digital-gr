'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface StaffProfile {
  id: string
  full_name: string
  role: 'school_admin' | 'staff' | 'principal'
  is_active: boolean
  email?: string
}

export default function StaffManagementPage() {
  const router = useRouter()
  const { profile, session } = useAuth()
  
  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'staff' as 'staff' | 'principal'
  })
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load staff
  useEffect(() => {
    if (!profile) return
    if (profile.role !== 'school_admin') {
      router.push('/dashboard')
      return
    }

    async function loadStaff() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_active')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true })

      if (!error && data) {
        setStaff(data as StaffProfile[])
      }
      setLoading(false)
    }

    loadStaff()
  }, [profile, router])

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          school_id: profile?.school_id
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create user')

      // Optimistic update or refetch
      setStaff((prev) => [
        ...prev,
        {
          id: data.userId,
          full_name: formData.full_name,
          role: formData.role,
          is_active: true
        }
      ])

      setIsFormOpen(false)
      setFormData({ full_name: '', email: '', password: '', role: 'staff' })
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'reactivate'} this user?`)) {
      return
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          userId,
          is_active: !currentStatus
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update user status')

      setStaff(prev => prev.map(s => 
        s.id === userId ? { ...s, is_active: !currentStatus } : s
      ))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating status')
    }
  }

  if (!profile || profile.role !== 'school_admin') return null

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Staff Management</h1>
          <p className="text-gray-400 mt-1 text-sm">Manage access for your school's staff and principal.</p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition cursor-pointer"
        >
          {isFormOpen ? 'Cancel' : '+ Add Staff'}
        </button>
      </div>

      {isFormOpen && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Create New Account</h2>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            {formError && (
              <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded-lg">
                {formError}
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="staff">Staff (Edit/Add Records)</option>
                  <option value="principal">Principal (View Only)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl border border-gray-800 bg-gray-900/60 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading staff directory...</div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No staff accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="border-b border-gray-800 bg-gray-900/40 text-gray-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-gray-300">
                {staff.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800/40 transition">
                    <td className="px-6 py-4 font-medium text-white">{user.full_name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-md bg-gray-800 px-2 py-1 text-xs font-medium text-gray-300 ring-1 ring-inset ring-gray-700">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-green-900/30 px-2 py-1 text-xs font-medium text-green-400 ring-1 ring-inset ring-green-900/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-red-900/30 px-2 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-900/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.role !== 'school_admin' && user.id !== profile.id && (
                        <button
                          onClick={() => toggleStatus(user.id, user.is_active)}
                          className={`text-xs font-medium px-3 py-1.5 rounded-md border transition ${
                            user.is_active 
                              ? 'border-red-900/50 text-red-400 hover:bg-red-900/20' 
                              : 'border-green-900/50 text-green-400 hover:bg-green-900/20'
                          }`}
                        >
                          {user.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                      {user.role === 'school_admin' && (
                        <span className="text-xs text-gray-500 italic">Cannot modify admin</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
