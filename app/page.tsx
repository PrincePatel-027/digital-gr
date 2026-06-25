'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function LandingPage() {
  const router = useRouter()
  const { session, loading } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && session) {
      router.replace('/dashboard')
    }
  }, [session, loading, router])

  if (!mounted) return null

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#e0f2fe] via-white to-[#f3e8ff]" />
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#e0f2fe]/60 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#dcfce7]/60 blur-3xl animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full bg-[#f3e8ff]/50 blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      {/* Navigation */}
      <header className="w-full px-6 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0f2846] flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className="text-xl font-bold text-[#0f2846] tracking-tight">Digital GR</span>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="rounded-xl bg-[#0f2846] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f2846]/90 transition shadow-md hover:shadow-lg min-h-[44px]"
        >
          Sign In
        </button>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 md:py-24 text-center max-w-5xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-white/60 border border-white/50 px-4 py-2 mb-8 shadow-sm backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-[#6b9e78] animate-pulse" />
          <span className="text-sm font-semibold text-[#0f2846]/80">School Record Digitization Platform</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-extrabold text-[#0f2846] leading-[1.1] tracking-tight mb-6">
          Digitize your school
          <br />
          <span className="bg-gradient-to-r from-[#3a86c6] to-[#7c5ec4] bg-clip-text text-transparent">
            General Registers
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-[#0f2846]/70 max-w-2xl mb-10 leading-relaxed font-medium">
          Upload scanned register pages, automatically extract student data with OCR,
          and securely manage records — all in one beautiful platform.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <button
            onClick={() => router.push('/login')}
            className="rounded-2xl bg-[#0f2846] px-8 py-4 text-base font-bold text-white hover:bg-[#0f2846]/90 transition shadow-lg hover:shadow-xl min-h-[56px] w-full sm:w-auto flex items-center justify-center gap-2"
          >
            Get Started
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <a
            href="#features"
            className="rounded-2xl glass-panel px-8 py-4 text-base font-bold text-[#0f2846] hover:bg-white/80 transition min-h-[56px] w-full sm:w-auto flex items-center justify-center"
          >
            Learn More
          </a>
        </div>

        {/* Feature Cards */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {/* Card 1 */}
          <div className="glass-panel rounded-[24px] p-8 text-left shadow-sm hover:shadow-md transition group">
            <div className="w-12 h-12 rounded-2xl bg-[#e0f2fe] flex items-center justify-center mb-5 group-hover:scale-110 transition">
              <svg className="w-6 h-6 text-[#3a86c6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0f2846] mb-2">Scan & Upload</h3>
            <p className="text-sm text-[#0f2846]/60 leading-relaxed font-medium">
              Snap a photo of any GR register page from your phone or upload existing scans.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel rounded-[24px] p-8 text-left shadow-sm hover:shadow-md transition group">
            <div className="w-12 h-12 rounded-2xl bg-[#f3e8ff] flex items-center justify-center mb-5 group-hover:scale-110 transition">
              <svg className="w-6 h-6 text-[#7c5ec4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0f2846] mb-2">AI-Powered OCR</h3>
            <p className="text-sm text-[#0f2846]/60 leading-relaxed font-medium">
              Automatically extract student names, dates, and details from handwritten registers.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel rounded-[24px] p-8 text-left shadow-sm hover:shadow-md transition group">
            <div className="w-12 h-12 rounded-2xl bg-[#dcfce7] flex items-center justify-center mb-5 group-hover:scale-110 transition">
              <svg className="w-6 h-6 text-[#6b9e78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#0f2846] mb-2">Secure & Searchable</h3>
            <p className="text-sm text-[#0f2846]/60 leading-relaxed font-medium">
              Role-based access, encrypted storage, and instant search across all records.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-6 text-center">
        <p className="text-sm text-[#0f2846]/40 font-medium">
          © {new Date().getFullYear()} Digital GR — Built for schools that deserve better records.
        </p>
      </footer>
    </div>
  )
}
