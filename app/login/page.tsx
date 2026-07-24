'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      const rawMsg = authError.message.toLowerCase()
      if (rawMsg.includes('invalid login credentials') || rawMsg.includes('invalid_credentials')) {
        setError('Wrong email or password. Please try again.')
      } else if (rawMsg.includes('email not confirmed') || rawMsg.includes('not confirmed')) {
        setError('Email not verified. Check your inbox.')
      } else if (rawMsg.includes('too many requests') || rawMsg.includes('rate limit')) {
        setError('Too many attempts. Wait a moment.')
      } else {
        setError('Sign in failed. Please try again.')
      }
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-dvh grid lg:grid-cols-2">
      {/* ── Brand panel (desktop) ─────────────────────────── */}
      <aside className="hidden lg:flex flex-col justify-between bg-surface border-r border-line p-12 xl:p-16">
        <button
          onClick={() => router.push('/')}
          className="font-display text-2xl tracking-tight self-start hover:text-accent transition-colors"
        >
          Digital GR
        </button>

        <div>
          <h1 className="text-[clamp(2.5rem,4vw,3.5rem)] leading-[1.02] mb-6">
            Welcome back to
            <br />
            the <span className="italic text-accent">archive</span>.
          </h1>
          <p className="font-gujarati text-lg text-ink-soft max-w-[36ch] leading-relaxed">
            શાળાના દરેક રેકોર્ડ સુરક્ષિત, વ્યવસ્થિત અને એક ક્લિકમાં શોધવા યોગ્ય.
          </p>
        </div>

        <p className="text-xs text-ink-faint">
          © {new Date().getFullYear()} Digital GR · School record digitization
        </p>
      </aside>

      {/* ── Form panel ────────────────────────────────────── */}
      <section className="flex flex-col justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm mx-auto">
          {/* Mobile brand */}
          <button
            onClick={() => router.push('/')}
            className="lg:hidden font-display text-3xl tracking-tight block mb-10 hover:text-accent transition-colors"
          >
            Digital GR
          </button>

          <div className="mb-8">
            <h2 className="font-display text-3xl tracking-tight mb-2">Sign in</h2>
            <p className="text-sm text-ink-soft">
              Enter your credentials to reach your dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            {error && (
              <div
                id="login-error"
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/[0.08] px-4 py-3"
              >
                <svg className="w-4 h-4 text-error mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-error font-medium">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-ink-soft mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@school.edu"
                aria-describedby={error ? 'login-error' : undefined}
                className={`neu-input ${error ? 'neu-input-error' : ''}`}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-ink-soft mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                aria-describedby={error ? 'login-error' : undefined}
                className={`neu-input ${error ? 'neu-input-error' : ''}`}
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="neu-btn neu-btn-primary w-full"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-2 text-xs text-ink-faint">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Encrypted connection · role-based access
          </div>
        </div>
      </section>
    </main>
  )
}
