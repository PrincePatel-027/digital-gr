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
      if (!res.ok) {
        // Provide friendlier error messages for common issues
        const rawError = data.error || 'Failed to create user'
        if (rawError.toLowerCase().includes('already') || rawError.toLowerCase().includes('duplicate')) {
          throw new Error('This email address is already in use. Please use a different email or check if this person already has an account.')
        }
        throw new Error(rawError)
      }

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
          <h1 className="text-3xl font-bold text-[#0f2846] tracking-tight">Staff Management</h1>
          <p className="text-[#0f2846]/70 mt-2 text-sm">Manage access for your school's staff and principal.</p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="rounded-xl bg-[#3a86c6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3a86c6]/90 shadow-md transition cursor-pointer min-h-[44px]"
        >
          {isFormOpen ? 'Cancel' : '+ Add Staff'}
        </button>
      </div>

      {isFormOpen && (
        <div className="rounded-[24px] glass-panel p-5 sm:p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#0f2846] mb-4">Create New Account</h2>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            {formError && (
              <div className="p-3 text-sm text-red-700 bg-red-50/80 border border-red-200 rounded-xl flex items-start gap-2 shadow-sm">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{formError}</span>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#0f2846]/80 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0f2846]/80 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0f2846]/80 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0f2846]/80 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as 'staff' | 'principal'})}
                  className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                >
                  <option value="staff">Staff (Edit/Add Records)</option>
                  <option value="principal">Principal (View Only)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-xl border border-[#0f2846]/20 bg-white/50 px-4 py-2.5 text-sm font-semibold text-[#0f2846] hover:bg-white/80 transition min-h-[44px] order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-[#0f2846] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0f2846]/90 transition disabled:opacity-50 min-h-[44px] shadow-md order-1 sm:order-2"
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff List */}
      <div className="rounded-[24px] glass-panel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#0f2846]/60">
            <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading staff directory...
          </div>
        ) : staff.length === 0 ? (
          /* Enhanced empty state */
          <div className="py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-[24px] bg-white/50 border border-white/60 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <svg className="w-8 h-8 text-[#3a86c6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0f2846] mb-2">No staff accounts yet</h3>
            <p className="text-sm text-[#0f2846]/70 max-w-sm mx-auto">
              Add your first staff member to let them start digitizing GR records. You can also add a principal for view-only access.
            </p>
            <button
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center mt-6 text-sm font-semibold text-[#3a86c6] hover:text-[#0f2846] underline transition"
            >
              + Add your first staff member
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table (md and up) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/40 bg-white/40 text-[#0f2846]/60">
                  <tr>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Name</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Role</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Status</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40 text-[#0f2846]/80">
                  {staff.map((user) => (
                    <tr key={user.id} className="hover:bg-white/40 transition">
                      <td className="px-6 py-4 font-bold text-[#0f2846]">{user.full_name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-[#0f2846]/10 px-2.5 py-1 text-xs font-bold text-[#0f2846] ring-1 ring-inset ring-[#0f2846]/20">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#6b9e78]/10 px-2.5 py-1 text-xs font-bold text-[#6b9e78] ring-1 ring-inset ring-[#6b9e78]/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#6b9e78]"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 ring-1 ring-inset ring-red-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.role !== 'school_admin' && user.id !== profile.id && (
                          <button
                            onClick={() => toggleStatus(user.id, user.is_active)}
                            className={`text-xs font-bold px-4 py-2 rounded-lg border transition shadow-sm bg-white/50 ${
                              user.is_active 
                                ? 'border-red-200 text-red-600 hover:bg-red-50' 
                                : 'border-[#6b9e78]/30 text-[#6b9e78] hover:bg-[#6b9e78]/10'
                            }`}
                          >
                            {user.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                        {user.role === 'school_admin' && (
                          <span className="text-xs text-[#0f2846]/50 italic font-medium">Cannot modify admin</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout (below md) */}
            <div className="md:hidden divide-y divide-white/40">
              {staff.map((user) => (
                <div key={user.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-[#0f2846]">{user.full_name}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center rounded-md bg-[#0f2846]/10 px-2 py-0.5 text-xs font-bold text-[#0f2846] ring-1 ring-inset ring-[#0f2846]/20">
                          {user.role}
                        </span>
                        {user.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#6b9e78]/10 px-2 py-0.5 text-xs font-bold text-[#6b9e78] ring-1 ring-inset ring-[#6b9e78]/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#6b9e78]"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600 ring-1 ring-inset ring-red-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                            Deactivated
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      {user.role !== 'school_admin' && user.id !== profile.id && (
                        <button
                          onClick={() => toggleStatus(user.id, user.is_active)}
                          className={`text-xs font-bold px-3 py-2 rounded-xl border transition min-h-[40px] shadow-sm bg-white/50 ${
                            user.is_active 
                              ? 'border-red-200 text-red-600 hover:bg-red-50' 
                              : 'border-[#6b9e78]/30 text-[#6b9e78] hover:bg-[#6b9e78]/10'
                          }`}
                        >
                          {user.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                      {user.role === 'school_admin' && (
                        <span className="text-xs text-[#0f2846]/50 italic font-medium">Admin</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
