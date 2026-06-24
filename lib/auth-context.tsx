'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────
export type UserRole = 'super_admin' | 'school_admin' | 'staff' | 'principal'

export interface Profile {
  id: string
  school_id: string | null
  role: UserRole
  full_name: string
  is_active: boolean
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

// ── Context ──────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// ── Provider ─────────────────────────────────────────────────
const PUBLIC_PATHS = ['/login', '/test-connection']

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch the user's profile row from the profiles table
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, school_id, role, full_name, is_active')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Failed to fetch profile:', error.message)
      return null
    }

    if (data && data.is_active === false) {
      await supabase.auth.signOut()
      alert('Your account has been deactivated. Please contact your administrator.')
      return null
    }

    return data as Profile
  }, [])

  // Sign out helper
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    router.push('/login')
  }, [router])

  // ── Bootstrap: get initial session ──────────────────────────
  useEffect(() => {
    let mounted = true

    async function init() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setSession(currentSession)

      if (currentSession?.user) {
        const p = await fetchProfile(currentSession.user.id)
        if (mounted) setProfile(p)
      }

      setLoading(false)
    }

    init()

    // Listen for auth state changes (login / logout / token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)

      if (newSession?.user) {
        const p = await fetchProfile(newSession.user.id)
        if (mounted) setProfile(p)
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // ── Route protection ────────────────────────────────────────
  useEffect(() => {
    if (loading) return

    const isPublic = PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + '/')
    )

    // Not logged in + trying to access protected route → redirect to login
    if (!session && !isPublic) {
      router.push('/login')
    }

    // Logged in + on the login page → redirect to dashboard
    if (session && pathname === '/login') {
      router.push('/dashboard')
    }
  }, [loading, session, pathname, router])

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
