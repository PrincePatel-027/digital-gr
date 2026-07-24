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
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function IconRecords() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function IconStaff() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IconSchools() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
      <div className="min-h-dvh flex items-center justify-center">
        <div className="flex items-center gap-3 text-ink-soft">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Loading…</span>
        </div>
      </div>
    )
  }

  const navItems = NAV_BY_ROLE[profile.role] ?? []

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const initial = profile.full_name?.[0]?.toUpperCase() || '?'

  const userMenu = (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
      <div className="absolute right-0 top-full mt-2 w-56 neu-card rounded-2xl p-1.5 z-50 shadow-[var(--shadow-md)] animate-scale-in origin-top-right">
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold truncate">{profile.full_name}</p>
          <p className="text-xs text-ink-faint mt-0.5">{ROLE_LABELS[profile.role]}</p>
        </div>
        <div className="h-px bg-line my-1" />
        <button
          onClick={() => { setShowUserMenu(false); signOut() }}
          className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 text-sm font-medium text-error hover:bg-error/[0.08] rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ── Desktop Top Nav ─────────────────────────────────── */}
      <header className="hidden sm:block sticky top-0 z-40 glass-nav">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-9 h-full">
            <Link href="/dashboard" className="flex flex-col justify-center">
              <span className="font-display text-xl tracking-tight leading-none">Digital GR</span>
              {profile?.schools?.name && (
                <span className="text-[10px] font-semibold text-accent tracking-wide mt-1 truncate max-w-[200px]">
                  {profile.schools.name}
                </span>
              )}
            </Link>

            <nav className="flex items-center h-full gap-1">
              {navItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative inline-flex items-center h-full px-3.5 text-sm transition-colors ${
                      active ? 'text-ink font-semibold' : 'text-ink-soft hover:text-ink font-medium'
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute inset-x-3 bottom-0 h-[2px] bg-accent rounded-full" />
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-full hover:bg-ink/[0.05] transition-colors"
            >
              <span className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center">
                <span className="text-xs font-bold text-white">{initial}</span>
              </span>
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold leading-none">{profile.full_name}</p>
                <p className="text-[10px] text-ink-faint mt-1">{ROLE_LABELS[profile.role]}</p>
              </div>
              <svg className={`w-4 h-4 text-ink-faint transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {showUserMenu && userMenu}
          </div>
        </div>
      </header>

      {/* ── Mobile Top Bar ──────────────────────────────────── */}
      <header className="sm:hidden sticky top-0 z-40 glass-nav">
        <div className="px-5 flex items-center justify-between py-2.5 min-h-[52px]">
          <Link href="/dashboard" className="flex flex-col">
            <span className="font-display text-xl tracking-tight leading-none">Digital GR</span>
            {profile?.schools?.name && (
              <span className="text-[9px] font-semibold text-accent tracking-wide mt-1 truncate max-w-[200px]">
                {profile.schools.name}
              </span>
            )}
          </Link>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center"
              aria-label="Account menu"
            >
              <span className="text-sm font-bold text-white">{initial}</span>
            </button>
            {showUserMenu && userMenu}
          </div>
        </div>
      </header>

      {/* ── Page Content ────────────────────────────────────── */}
      <main id="main-content" tabIndex={-1} className="flex-1 pb-safe focus:outline-none">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-7 sm:py-10">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Tab Bar ───────────────────────────── */}
      <nav className="bottom-tabs sm:hidden" aria-label="Primary">
        <div className="flex items-center justify-around px-2 pt-1.5 pb-1">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[64px] transition-colors ${
                  active ? 'text-accent' : 'text-ink-faint'
                }`}
              >
                {active && (
                  <span className="absolute top-0 w-8 h-[3px] bg-accent rounded-full" />
                )}
                {item.icon}
                <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
