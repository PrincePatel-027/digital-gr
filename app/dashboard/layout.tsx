'use client'

import { useState } from 'react'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Show nothing while auth is resolving (the AuthProvider will redirect
  // to /login if the user is not authenticated)
  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex items-center gap-3 text-[#0f2846]/70">
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
    <div className="min-h-screen bg-transparent flex flex-col">
      {/* ── Top Nav ─────────────────────────────────────────── */}
      <header className="border-b border-white/40 bg-white/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: brand + nav */}
            <div className="flex items-center gap-8">
              <Link
                href="/dashboard"
                className="text-xl font-bold text-[#0f2846] tracking-tight"
              >
                Digital GR
              </Link>

              {/* Desktop nav */}
              <nav className="hidden sm:flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-white/60 text-[#0f2846] shadow-sm'
                          : 'text-[#0f2846]/70 hover:text-[#0f2846] hover:bg-white/40'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Right: user info + logout (desktop) */}
            <div className="hidden sm:flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-[#0f2846] leading-tight">
                  {profile.full_name}
                </p>
                <p className="text-xs text-[#0f2846]/70">
                  {ROLE_LABELS[profile.role]}
                </p>
              </div>

              <button
                id="logout-button"
                onClick={signOut}
                className="rounded-lg border border-white/50 bg-white/40 px-3 py-1.5 text-sm font-medium text-[#0f2846] hover:bg-white/60 shadow-sm transition"
              >
                Sign out
              </button>
            </div>

            {/* Mobile: Hamburger button */}
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden flex items-center justify-center w-10 h-10 rounded-lg text-[#0f2846]/80 hover:text-[#0f2846] hover:bg-white/40 transition"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                /* Close icon (X) */
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                /* Hamburger icon */
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile slide-down menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-white/40 bg-white/80 backdrop-blur-xl">
            {/* User info */}
            <div className="px-4 py-3 border-b border-white/40">
              <p className="text-sm font-semibold text-[#0f2846]">{profile.full_name}</p>
              <p className="text-xs text-[#0f2846]/70 mt-0.5">{ROLE_LABELS[profile.role]}</p>
            </div>

            {/* Nav links */}
            <nav className="px-2 py-2 space-y-1">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-3 py-3 rounded-xl text-sm font-medium transition ${
                  pathname === '/dashboard'
                    ? 'bg-white/60 text-[#0f2846] shadow-sm'
                    : 'text-[#0f2846]/70 hover:text-[#0f2846] hover:bg-white/40'
                }`}
              >
                Dashboard
              </Link>
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-3 rounded-xl text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/60 text-[#0f2846] shadow-sm'
                        : 'text-[#0f2846]/70 hover:text-[#0f2846] hover:bg-white/40'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Sign out */}
            <div className="px-2 py-2 border-t border-white/40">
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  signOut()
                }}
                className="w-full flex items-center justify-center px-3 py-3 rounded-xl border border-white/50 bg-white/40 text-sm font-medium text-[#0f2846] hover:bg-white/60 shadow-sm transition"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Page Content ───────────────────────────────────── */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
