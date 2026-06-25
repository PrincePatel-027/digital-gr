'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth, type UserRole } from '@/lib/auth-context'

// ── Navigation items per role ─────────────────────────────────
interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

function IconHome() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function IconRecords() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function IconStaff() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IconSchools() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  )
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: 'Home', href: '/dashboard', icon: <IconHome /> },
    { label: 'Schools', href: '/dashboard/schools', icon: <IconSchools /> },
  ],
  school_admin: [
    { label: 'Home', href: '/dashboard', icon: <IconHome /> },
    { label: 'Records', href: '/dashboard/records', icon: <IconRecords /> },
    { label: 'Staff', href: '/dashboard/staff', icon: <IconStaff /> },
  ],
  staff: [
    { label: 'Home', href: '/dashboard', icon: <IconHome /> },
    { label: 'Records', href: '/dashboard/records', icon: <IconRecords /> },
  ],
  principal: [
    { label: 'Home', href: '/dashboard', icon: <IconHome /> },
    { label: 'Records', href: '/dashboard/records', icon: <IconRecords /> },
  ],
}

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
  const { profile, loading, signOut } = useAuth()
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#6b6b6b]">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-semibold">Loading…</span>
        </div>
      </div>
    )
  }

  const navItems = NAV_BY_ROLE[profile.role] ?? []

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Desktop Top Nav ─────────────────────────────────── */}
      <header className="hidden sm:block sticky top-0 z-50 bg-[#f0ede8] border-b-2 border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          {/* Left: brand + nav */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-extrabold tracking-tight">
              Digital GR
            </Link>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${
                    isActive(item.href)
                      ? 'bg-[#1a1a1a] text-[#f0ede8]'
                      : 'text-[#6b6b6b] hover:text-[#1a1a1a]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: user */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-black/5 transition"
            >
              <div className="w-7 h-7 rounded-md bg-[#4338ca] flex items-center justify-center">
                <span className="text-xs font-bold text-white">
                  {profile.full_name?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-bold leading-none">{profile.full_name}</p>
                <p className="text-[10px] text-[#6b6b6b] font-semibold uppercase mt-0.5">
                  {ROLE_LABELS[profile.role]}
                </p>
              </div>
              <svg className="w-4 h-4 text-[#6b6b6b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 neu-card p-2 z-50">
                  <button
                    onClick={() => { setShowUserMenu(false); signOut() }}
                    className="w-full text-left px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-md transition"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile Top Bar (just brand + avatar) ───────────── */}
      <header className="sm:hidden sticky top-0 z-50 bg-[#f0ede8] border-b-2 border-[#1a1a1a]">
        <div className="px-5 flex items-center justify-between h-12">
          <Link href="/dashboard" className="text-lg font-extrabold tracking-tight">
            Digital GR
          </Link>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-md bg-[#4338ca] flex items-center justify-center"
            >
              <span className="text-xs font-bold text-white">
                {profile.full_name?.[0]?.toUpperCase() || '?'}
              </span>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 neu-card p-2 z-50">
                  <div className="px-3 py-2 border-b border-[#d4d0c8] mb-1">
                    <p className="text-xs font-bold">{profile.full_name}</p>
                    <p className="text-[10px] text-[#6b6b6b] font-semibold uppercase">
                      {ROLE_LABELS[profile.role]}
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); signOut() }}
                    className="w-full text-left px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-md transition"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Page Content ───────────────────────────────────── */}
      <main className="flex-1 pb-safe">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Tab Bar ──────────────────────────── */}
      <nav className="bottom-tabs sm:hidden">
        <div className="flex items-center justify-around px-2 pt-2 pb-1">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[64px] transition ${
                  active
                    ? 'text-[#4338ca]'
                    : 'text-[#9a9590]'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
