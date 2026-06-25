'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function LandingPage() {
  const router = useRouter()
  const { session, loading } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!loading && session) router.replace('/dashboard')
  }, [session, loading, router])

  if (!mounted) return null

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="px-5 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="text-xl font-extrabold tracking-tight">Digital GR</span>
        <button
          onClick={() => router.push('/login')}
          className="neu-btn neu-btn-primary text-xs px-5 min-h-[40px]"
        >
          Sign In
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-16 md:py-24 text-center max-w-4xl mx-auto">
        {/* Badge */}
        <div className="neu-badge bg-[#4338ca]/10 text-[#4338ca] mb-8">
          <span className="w-2 h-2 rounded-full bg-[#4338ca]" />
          School Record Platform
        </div>

        {/* Headline */}
        <h1 className="text-[clamp(2.5rem,8vw,5rem)] font-extrabold leading-[0.95] tracking-tight mb-6">
          Digitize your
          <br />
          <span className="text-[#4338ca]">General Registers</span>
        </h1>

        {/* Sub */}
        <p className="text-base md:text-lg text-[#6b6b6b] max-w-xl mb-10 leading-relaxed font-medium">
          Upload scanned register pages, auto-extract student data with OCR,
          and manage records securely.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-20 w-full sm:w-auto">
          <button
            onClick={() => router.push('/login')}
            className="neu-btn neu-btn-primary w-full sm:w-auto px-10"
          >
            Get Started →
          </button>
          <a
            href="#features"
            className="neu-btn neu-btn-ghost w-full sm:w-auto px-10"
          >
            Learn More
          </a>
        </div>

        {/* Feature Cards */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
          <div className="neu-card p-7 text-left">
            <div className="w-11 h-11 rounded-lg bg-[#1a1a1a] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-[#f0ede8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <h3 className="text-base font-extrabold mb-2">Scan & Upload</h3>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">
              Snap a photo of any GR page or upload existing scans directly.
            </p>
          </div>

          <div className="neu-card p-7 text-left">
            <div className="w-11 h-11 rounded-lg bg-[#4338ca] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h3 className="text-base font-extrabold mb-2">AI-Powered OCR</h3>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">
              Auto-extract student details from handwritten registers in Gujarati & English.
            </p>
          </div>

          <div className="neu-card p-7 text-left">
            <div className="w-11 h-11 rounded-lg bg-[#16a34a] flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="text-base font-extrabold mb-2">Secure & Searchable</h3>
            <p className="text-sm text-[#6b6b6b] leading-relaxed">
              Role-based access, encrypted storage, and instant search across records.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-5 py-6 text-center">
        <p className="text-xs text-[#9a9590] font-semibold uppercase tracking-wider">
          © {new Date().getFullYear()} Digital GR
        </p>
      </footer>
    </div>
  )
}
