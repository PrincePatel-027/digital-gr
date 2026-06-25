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

const ROLE_LABELS: Record<string, string> = {
  school_admin: 'Admin',
  staff: 'Staff',
  principal: 'Principal',
}

export default function StaffManagementPage() {
  const router = useRouter()
  const { profile, session } = useAuth()

  const [staff, setStaff] = useState<StaffProfile[]>([])
  const [loading, setLoading] = useState(true)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'staff' as 'staff' | 'principal'
  })
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!profile) return
    if (profile.role !== 'school_admin') { router.push('/dashboard'); return }

    async function loadStaff() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_active')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true })
      if (!error && data) setStaff(data as StaffProfile[])
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
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
        const rawError = data.error || 'Failed to create user'
        if (rawError.toLowerCase().includes('already') || rawError.toLowerCase().includes('duplicate')) {
          throw new Error('This email is already in use.')
        }
        throw new Error(rawError)
      }
      setStaff((prev) => [...prev, { id: data.userId, full_name: formData.full_name, role: formData.role, is_active: true }])
      setIsFormOpen(false)
      setFormData({ full_name: '', email: '', password: '', role: 'staff' })
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`${currentStatus ? 'Deactivate' : 'Reactivate'} this user?`)) return
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId, is_active: !currentStatus })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      setStaff(prev => prev.map(s => s.id === userId ? { ...s, is_active: !currentStatus } : s))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  if (!profile || profile.role !== 'school_admin') return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Staff</h1>
          <p className="text-sm text-[#6b6b6b] mt-1 font-medium">Manage access for your school.</p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className={`neu-btn text-xs w-full sm:w-auto ${isFormOpen ? 'neu-btn-ghost' : 'neu-btn-accent'}`}
        >
          {isFormOpen ? 'Cancel' : '+ Add Staff'}
        </button>
      </div>

      {/* Create Form */}
      {isFormOpen && (
        <div className="neu-card p-5 sm:p-6">
          <h2 className="text-base font-extrabold mb-4">New Account</h2>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            {formError && (
              <div className="neu-card-flat p-3" style={{ borderColor: '#dc2626' }}>
                <p className="text-sm text-red-700 font-bold">{formError}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b] mb-2">Full Name *</label>
                <input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  placeholder="e.g. Rajesh Patel"
                  className="neu-input"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b] mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="staff@school.com"
                  className="neu-input"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b] mb-2">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  className="neu-input"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6b6b6b] mb-2">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'staff' | 'principal' })}
                  className="neu-input"
                >
                  <option value="staff">Staff</option>
                  <option value="principal">Principal</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="neu-btn neu-btn-primary text-xs w-full sm:w-auto">
              {isSubmitting ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-[#6b6b6b]">
          <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-semibold">Loading…</span>
        </div>
      )}

      {/* Staff List — Desktop */}
      {!loading && staff.length > 0 && (
        <div className="hidden sm:block neu-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#1a1a1a]">
                <th className="px-5 py-3.5 text-left text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider">Name</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider">Role</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-right text-[10px] font-bold text-[#6b6b6b] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d4d0c8]">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-black/[0.02] transition">
                  <td className="px-5 py-3.5 font-bold">{s.full_name}</td>
                  <td className="px-5 py-3.5">
                    <span className="neu-badge bg-[#1a1a1a]/5 text-[#1a1a1a]">{ROLE_LABELS[s.role] || s.role}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase ${s.is_active ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                      <span className={`w-2 h-2 rounded-full ${s.is_active ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`} />
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {s.id !== profile.id && (
                      <button
                        onClick={() => toggleStatus(s.id, s.is_active)}
                        className={`text-xs font-bold ${s.is_active ? 'text-[#dc2626] hover:underline' : 'text-[#16a34a] hover:underline'}`}
                      >
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Staff List — Mobile Cards */}
      {!loading && staff.length > 0 && (
        <div className="sm:hidden space-y-3">
          {staff.map((s) => (
            <div key={s.id} className="neu-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-extrabold">{s.full_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="neu-badge bg-[#1a1a1a]/5 text-[#1a1a1a]">{ROLE_LABELS[s.role] || s.role}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${s.is_active ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-[#16a34a]' : 'bg-[#dc2626]'}`} />
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                {s.id !== profile.id && (
                  <button
                    onClick={() => toggleStatus(s.id, s.is_active)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-md border-2 min-h-[36px] ${
                      s.is_active
                        ? 'border-[#dc2626]/20 text-[#dc2626] hover:border-[#dc2626]'
                        : 'border-[#16a34a]/20 text-[#16a34a] hover:border-[#16a34a]'
                    } transition`}
                  >
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && staff.length === 0 && (
        <div className="neu-card p-10 text-center">
          <h3 className="text-lg font-extrabold mb-2">No staff members</h3>
          <p className="text-sm text-[#6b6b6b]">Add your first staff member above.</p>
        </div>
      )}
    </div>
  )
}
