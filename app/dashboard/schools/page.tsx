'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface School {
  id: string
  name: string
  address: string | null
  contact_email: string | null
  contact_phone: string | null
  created_at: string
}

export default function SchoolsManagementPage() {
  const router = useRouter()
  const { profile, session } = useAuth()
  
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  
  // Create School Form State
  const [isSchoolFormOpen, setIsSchoolFormOpen] = useState(false)
  const [schoolForm, setSchoolForm] = useState({
    name: '', address: '', contact_email: '', contact_phone: ''
  })
  const [schoolError, setSchoolError] = useState('')
  const [isCreatingSchool, setIsCreatingSchool] = useState(false)

  // Create Admin Form State
  const [adminFormOpenFor, setAdminFormOpenFor] = useState<string | null>(null)
  const [adminForm, setAdminForm] = useState({
    full_name: '', email: '', password: ''
  })
  const [adminError, setAdminError] = useState('')
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false)

  useEffect(() => {
    if (!profile) return
    if (profile.role !== 'super_admin') {
      router.push('/dashboard')
      return
    }

    async function loadSchools() {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setSchools(data as School[])
      }
      setLoading(false)
    }

    loadSchools()
  }, [profile, router])

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault()
    setSchoolError('')
    setIsCreatingSchool(true)

    try {
      const res = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(schoolForm)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create school')

      setSchools([{
        id: data.schoolId,
        ...schoolForm,
        created_at: new Date().toISOString()
      }, ...schools])

      setIsSchoolFormOpen(false)
      setSchoolForm({ name: '', address: '', contact_email: '', contact_phone: '' })
    } catch (err: unknown) {
      setSchoolError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsCreatingSchool(false)
    }
  }

  const handleCreateAdmin = async (e: React.FormEvent, schoolId: string) => {
    e.preventDefault()
    setAdminError('')
    setIsCreatingAdmin(true)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          ...adminForm,
          role: 'school_admin',
          school_id: schoolId
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create admin')

      alert('Admin account created successfully!')
      setAdminFormOpenFor(null)
      setAdminForm({ full_name: '', email: '', password: '' })
    } catch (err: unknown) {
      setAdminError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsCreatingAdmin(false)
    }
  }

  if (!profile || profile.role !== 'super_admin') return null

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0f2846] tracking-tight">Schools Management</h1>
          <p className="text-[#0f2846]/70 mt-2 text-sm">Manage tenants and provision their initial admin accounts.</p>
        </div>
        <button
          onClick={() => setIsSchoolFormOpen(!isSchoolFormOpen)}
          className="rounded-xl bg-[#3a86c6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3a86c6]/90 shadow-md transition cursor-pointer min-h-[44px]"
        >
          {isSchoolFormOpen ? 'Cancel' : '+ Add School'}
        </button>
      </div>

      {isSchoolFormOpen && (
        <div className="rounded-[24px] glass-panel p-6 shadow-sm">
          <h2 className="text-xl font-bold text-[#0f2846] mb-4">Register New School</h2>
          <form onSubmit={handleCreateSchool} className="space-y-4">
            {schoolError && (
              <div className="p-3 text-sm text-red-700 bg-red-50/80 border border-red-200 rounded-xl shadow-sm">
                {schoolError}
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#0f2846]/80 mb-1">School Name *</label>
                <input
                  type="text"
                  required
                  value={schoolForm.name}
                  onChange={(e) => setSchoolForm({...schoolForm, name: e.target.value})}
                  className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#0f2846]/80 mb-1">Address</label>
                <input
                  type="text"
                  value={schoolForm.address}
                  onChange={(e) => setSchoolForm({...schoolForm, address: e.target.value})}
                  className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0f2846]/80 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={schoolForm.contact_email}
                  onChange={(e) => setSchoolForm({...schoolForm, contact_email: e.target.value})}
                  className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#0f2846]/80 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={schoolForm.contact_phone}
                  onChange={(e) => setSchoolForm({...schoolForm, contact_phone: e.target.value})}
                  className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsSchoolFormOpen(false)}
                className="rounded-xl border border-[#0f2846]/20 bg-white/50 px-4 py-2.5 text-sm font-semibold text-[#0f2846] hover:bg-white/80 transition min-h-[44px] order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingSchool}
                className="rounded-xl bg-[#0f2846] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0f2846]/90 transition disabled:opacity-50 min-h-[44px] shadow-md order-1 sm:order-2"
              >
                {isCreatingSchool ? 'Creating...' : 'Register School'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-[#0f2846]/60 rounded-[24px] glass-panel">
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading schools...
            </div>
          </div>
        ) : schools.length === 0 ? (
          <div className="py-16 px-6 text-center rounded-[24px] border-dashed glass-panel">
            <div className="w-16 h-16 rounded-[24px] bg-white/50 border border-white/60 shadow-sm flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-[#3a86c6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0f2846] mb-2">No schools have been registered</h3>
            <p className="text-sm text-[#0f2846]/70 max-w-sm mx-auto">
              Add your first school to start managing GR records. You can provision an admin account for each school after registering it.
            </p>
            <button
              onClick={() => setIsSchoolFormOpen(true)}
              className="inline-flex items-center mt-6 text-sm font-semibold text-[#3a86c6] hover:text-[#0f2846] underline transition"
            >
              + Register your first school
            </button>
          </div>
        ) : (
          schools.map((school) => (
            <div key={school.id} className="rounded-[24px] glass-panel p-6 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
              <div>
                <h3 className="text-xl font-bold text-[#0f2846]">{school.name}</h3>
                <p className="text-sm text-[#0f2846]/60 mt-1 break-all font-mono font-medium">
                  ID: {school.id}
                </p>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-[#0f2846]/70 font-medium">
                  {school.contact_email && <span>Email: {school.contact_email}</span>}
                  {school.contact_phone && <span>Phone: {school.contact_phone}</span>}
                  <span>Added: {new Date(school.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex-shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => setAdminFormOpenFor(adminFormOpenFor === school.id ? null : school.id)}
                  className="w-full sm:w-auto rounded-xl border border-[#0f2846]/20 bg-white/50 px-4 py-2.5 text-sm font-semibold text-[#0f2846] hover:bg-white/80 transition min-h-[44px]"
                >
                  {adminFormOpenFor === school.id ? 'Cancel' : 'Provision Admin'}
                </button>
              </div>

              {/* Inline Form for creating admin for THIS school */}
              {adminFormOpenFor === school.id && (
                <div className="w-full mt-6 border-t border-white/40 pt-6">
                  <h4 className="text-base font-bold text-[#0f2846] mb-4">Create Initial Admin for {school.name}</h4>
                  <form onSubmit={(e) => handleCreateAdmin(e, school.id)} className="space-y-4">
                    {adminError && (
                      <div className="p-3 text-sm text-red-700 bg-red-50/80 border border-red-200 rounded-xl shadow-sm">
                        {adminError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          value={adminForm.full_name}
                          onChange={(e) => setAdminForm({...adminForm, full_name: e.target.value})}
                          className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                        />
                      </div>
                      <div>
                        <input
                          type="email"
                          required
                          placeholder="Admin Email"
                          value={adminForm.email}
                          onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                          className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                        />
                      </div>
                      <div>
                        <input
                          type="password"
                          required
                          placeholder="Password (min 6 chars)"
                          minLength={6}
                          value={adminForm.password}
                          onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                          className="w-full rounded-xl glass-input px-3 py-2.5 text-sm transition min-h-[44px]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        type="submit"
                        disabled={isCreatingAdmin}
                        className="rounded-xl bg-[#0f2846] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f2846]/90 shadow-md transition disabled:opacity-50 min-h-[44px] w-full sm:w-auto"
                      >
                        {isCreatingAdmin ? 'Creating...' : 'Create Admin Account'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
