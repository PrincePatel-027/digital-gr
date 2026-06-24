'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import type { UserRole } from '@/lib/types'

interface NavItem {
  label: string
  href: string
}

/** Navigation links per role */
const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: 'Schools', href: '/dashboard/schools' },
  ],
  school_admin: [
    { label: 'GR Records', href: '/dashboard/records' },
    { label: 'Staff Management', href: '/dashboard/staff' },
  ],
  staff: [
    { label: 'GR Records', href: '/dashboard/records' },
  ],
  principal: [
    { label: 'GR Records', href: '/dashboard/records' },
  ],
}

/** Human-readable role labels */
const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  staff: 'Staff',
  principal: 'Principal',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <DashboardShell>{children}</DashboardShell>
    </ProtectedRoute>
  )
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading profile…</p>
        </div>
      </div>
    )
  }

  const navItems = NAV_BY_ROLE[profile.role] || []

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top nav bar */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo + nav links */}
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-white hidden sm:block">Digital GR</span>
              </Link>

              {/* Nav links */}
              <div className="flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Right: User info + logout */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white leading-none">
                  {profile.full_name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {ROLE_LABELS[profile.role]}
                </p>
              </div>

              {/* Mobile: show role badge */}
              <span className="sm:hidden inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-1 text-xs font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                {ROLE_LABELS[profile.role]}
              </span>

              <button
                onClick={handleSignOut}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
