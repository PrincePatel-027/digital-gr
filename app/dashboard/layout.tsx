'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth, type UserRole } from '@/lib/auth-context'

// ── Navigation items per role ─────────────────────────────────
interface NavItem {
  label: string
  href: string
}

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

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  staff: 'Staff',
  principal: 'Principal',
}

// ── Layout Component ──────────────────────────────────────────
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, loading, signOut } = useAuth()
  const pathname = usePathname()

  // Show nothing while auth is resolving (the AuthProvider will redirect
  // to /login if the user is not authenticated)
  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex items-center gap-3 text-gray-400">
          <svg
            className="w-5 h-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  const navItems = NAV_BY_ROLE[profile.role] ?? []

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Top Nav ─────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: brand + nav */}
            <div className="flex items-center gap-8">
              <Link
                href="/dashboard"
                className="text-lg font-bold text-white tracking-tight"
              >
                Digital GR
              </Link>

              <nav className="hidden sm:flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                        isActive
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Right: user info + logout */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white leading-tight">
                  {profile.full_name}
                </p>
                <p className="text-xs text-gray-500">
                  {ROLE_LABELS[profile.role]}
                </p>
              </div>

              {/* Role badge (mobile) */}
              <span className="sm:hidden inline-flex items-center rounded-full bg-indigo-900/50 border border-indigo-700/50 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                {ROLE_LABELS[profile.role]}
              </span>

              <button
                id="logout-button"
                onClick={signOut}
                className="rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:border-gray-600 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="sm:hidden border-t border-gray-800 px-4 py-2 flex gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      {/* ── Page Content ───────────────────────────────────── */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
