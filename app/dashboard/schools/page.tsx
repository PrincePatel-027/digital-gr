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
  const [adminSuccess, setAdminSuccess] = useState('')
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
    setAdminSuccess('')
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

      setAdminSuccess(`Admin account created for ${adminForm.full_name || 'this school'}.`)
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
    <div className="space-y-7 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">Schools</h1>
          <p className="text-sm text-ink-soft mt-2">
            Manage tenants and provision their initial admin accounts.
          </p>
        </div>
        <button
          onClick={() => setIsSchoolFormOpen(!isSchoolFormOpen)}
          className={`neu-btn w-full sm:w-auto ${isSchoolFormOpen ? 'neu-btn-ghost' : 'neu-btn-accent'}`}
        >
          {isSchoolFormOpen ? 'Cancel' : 'Add school'}
        </button>
      </div>

      {/* Success banner */}
      {adminSuccess && (
        <div className="rounded-xl border border-success/25 bg-success/[0.08] px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-success">{adminSuccess}</p>
          <button onClick={() => setAdminSuccess('')} className="text-success/70 hover:text-success" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Create school form */}
      {isSchoolFormOpen && (
        <div className="neu-card p-5 sm:p-7">
          <h2 className="font-display text-xl mb-5">Register a new school</h2>
          <form onSubmit={handleCreateSchool} className="space-y-4">
            {schoolError && (
              <div className="neu-card-flat p-3" style={{ borderColor: '#dc2626' }}>
                <p className="text-sm text-error font-medium">{schoolError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-ink-soft mb-2">School name *</label>
                <input
                  type="text"
                  required
                  value={schoolForm.name}
                  onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                  className="neu-input"
                  placeholder="e.g. Shree Vidyalaya Primary School"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-ink-soft mb-2">Address</label>
                <input
                  type="text"
                  value={schoolForm.address}
                  onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                  className="neu-input"
                  placeholder="Town / district"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-2">Contact email</label>
                <input
                  type="email"
                  value={schoolForm.contact_email}
                  onChange={(e) => setSchoolForm({ ...schoolForm, contact_email: e.target.value })}
                  className="neu-input"
                  placeholder="office@school.edu"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-2">Contact phone</label>
                <input
                  type="text"
                  value={schoolForm.contact_phone}
                  onChange={(e) => setSchoolForm({ ...schoolForm, contact_phone: e.target.value })}
                  className="neu-input"
                  placeholder="+91 …"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsSchoolFormOpen(false)}
                className="neu-btn neu-btn-ghost w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingSchool}
                className="neu-btn neu-btn-primary w-full sm:w-auto"
              >
                {isCreatingSchool ? 'Creating…' : 'Register school'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Schools list */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="neu-card p-6 space-y-3">
                <div className="h-5 w-48 rounded bg-surface-2 animate-pulse" />
                <div className="h-3 w-64 rounded bg-surface-2 animate-pulse" />
              </div>
            ))}
          </div>
        ) : schools.length === 0 ? (
          <div className="neu-card p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-ink flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-paper" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
              </svg>
            </div>
            <h2 className="font-display text-2xl mb-2">No schools yet</h2>
            <p className="text-sm text-ink-soft max-w-sm mx-auto">
              Add your first school to start managing GR records. You can provision an
              admin account for each school after registering it.
            </p>
            <button
              onClick={() => setIsSchoolFormOpen(true)}
              className="neu-btn neu-btn-primary mt-6 inline-flex"
            >
              Register first school
            </button>
          </div>
        ) : (
          schools.map((school) => (
            <div key={school.id} className="neu-card p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-5 justify-between sm:items-start">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">{school.name}</h3>
                  <p className="text-xs text-ink-faint mt-1 break-all text-mono">
                    {school.id}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-ink-soft">
                    {school.contact_email && <span>{school.contact_email}</span>}
                    {school.contact_phone && <span>{school.contact_phone}</span>}
                    <span className="text-ink-faint">Added {new Date(school.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => { setAdminError(''); setAdminFormOpenFor(adminFormOpenFor === school.id ? null : school.id) }}
                    className="neu-btn neu-btn-ghost w-full sm:w-auto"
                  >
                    {adminFormOpenFor === school.id ? 'Cancel' : 'Provision admin'}
                  </button>
                </div>
              </div>

              {/* Inline admin creation form */}
              {adminFormOpenFor === school.id && (
                <div className="mt-6 border-t border-line pt-6">
                  <h4 className="text-sm font-semibold mb-4">Create initial admin for {school.name}</h4>
                  <form onSubmit={(e) => handleCreateAdmin(e, school.id)} className="space-y-4">
                    {adminError && (
                      <div className="neu-card-flat p-3" style={{ borderColor: '#dc2626' }}>
                        <p className="text-sm text-error font-medium">{adminError}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <input
                        type="text"
                        required
                        placeholder="Full name"
                        value={adminForm.full_name}
                        onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                        className="neu-input"
                      />
                      <input
                        type="email"
                        required
                        placeholder="Admin email"
                        value={adminForm.email}
                        onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                        className="neu-input"
                      />
                      <input
                        type="password"
                        required
                        placeholder="Password (min 6 chars)"
                        minLength={6}
                        value={adminForm.password}
                        onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                        className="neu-input"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isCreatingAdmin}
                        className="neu-btn neu-btn-primary w-full sm:w-auto"
                      >
                        {isCreatingAdmin ? 'Creating…' : 'Create admin account'}
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
