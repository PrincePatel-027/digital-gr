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
          <h1 className="text-2xl font-bold text-white tracking-tight">Schools Management</h1>
          <p className="text-gray-400 mt-1 text-sm">Manage tenants and provision their initial admin accounts.</p>
        </div>
        <button
          onClick={() => setIsSchoolFormOpen(!isSchoolFormOpen)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition cursor-pointer"
        >
          {isSchoolFormOpen ? 'Cancel' : '+ Add School'}
        </button>
      </div>

      {isSchoolFormOpen && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Register New School</h2>
          <form onSubmit={handleCreateSchool} className="space-y-4">
            {schoolError && (
              <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/50 rounded-lg">
                {schoolError}
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">School Name *</label>
                <input
                  type="text"
                  required
                  value={schoolForm.name}
                  onChange={(e) => setSchoolForm({...schoolForm, name: e.target.value})}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
                <input
                  type="text"
                  value={schoolForm.address}
                  onChange={(e) => setSchoolForm({...schoolForm, address: e.target.value})}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={schoolForm.contact_email}
                  onChange={(e) => setSchoolForm({...schoolForm, contact_email: e.target.value})}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={schoolForm.contact_phone}
                  onChange={(e) => setSchoolForm({...schoolForm, contact_phone: e.target.value})}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="submit"
                disabled={isCreatingSchool}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
              >
                {isCreatingSchool ? 'Creating...' : 'Register School'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-gray-500 rounded-2xl border border-gray-800 bg-gray-900/60">
            Loading schools...
          </div>
        ) : schools.length === 0 ? (
          <div className="p-8 text-center text-gray-500 rounded-2xl border border-gray-800 bg-gray-900/60">
            No schools registered yet.
          </div>
        ) : (
          schools.map((school) => (
            <div key={school.id} className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
              <div>
                <h3 className="text-lg font-semibold text-white">{school.name}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  ID: <span className="font-mono text-xs">{school.id}</span>
                </p>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                  {school.contact_email && <span>Email: {school.contact_email}</span>}
                  {school.contact_phone && <span>Phone: {school.contact_phone}</span>}
                  <span>Added: {new Date(school.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex-shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => setAdminFormOpenFor(adminFormOpenFor === school.id ? null : school.id)}
                  className="w-full sm:w-auto rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
                >
                  {adminFormOpenFor === school.id ? 'Cancel' : 'Provision Admin Account'}
                </button>
              </div>

              {/* Inline Form for creating admin for THIS school */}
              {adminFormOpenFor === school.id && (
                <div className="w-full mt-4 border-t border-gray-800 pt-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Create Initial Admin for {school.name}</h4>
                  <form onSubmit={(e) => handleCreateAdmin(e, school.id)} className="space-y-4">
                    {adminError && (
                      <div className="p-2 text-xs text-red-400 bg-red-900/20 border border-red-900/50 rounded-lg">
                        {adminError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          value={adminForm.full_name}
                          onChange={(e) => setAdminForm({...adminForm, full_name: e.target.value})}
                          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <input
                          type="email"
                          required
                          placeholder="Admin Email"
                          value={adminForm.email}
                          onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500"
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
                          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isCreatingAdmin}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
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
