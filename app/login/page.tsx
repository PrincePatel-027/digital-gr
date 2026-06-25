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
      // Map raw Supabase error messages to friendly equivalents
      const rawMsg = authError.message.toLowerCase()
      if (rawMsg.includes('invalid login credentials') || rawMsg.includes('invalid_credentials')) {
        setError('The email or password you entered doesn\'t match our records. Please double-check and try again.')
      } else if (rawMsg.includes('email not confirmed') || rawMsg.includes('not confirmed')) {
        setError('Your account email hasn\'t been verified yet. Please check your inbox for a confirmation link.')
      } else if (rawMsg.includes('too many requests') || rawMsg.includes('rate limit')) {
        setError('Too many login attempts. Please wait a moment and try again.')
      } else {
        setError('We\'re having trouble signing you in right now. Please try again in a moment.')
      }
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-transparent px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#0f2846] tracking-tight">
            Digital GR
          </h1>
          <p className="text-sm text-[#0f2846]/70 mt-2">
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleLogin}
          className="rounded-[24px] glass-panel p-6 sm:p-8 space-y-6"
        >
          {/* Error */}
          {error && (
            <div
              id="login-error"
              className="rounded-xl bg-red-50/80 border border-red-200 px-4 py-3 flex items-start gap-2"
              role="alert"
            >
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[#0f2846]/80"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@school.com"
              className="w-full rounded-xl glass-input px-3 py-2.5 text-sm placeholder-[#0f2846]/40 transition"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[#0f2846]/80"
            >
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
              className="w-full rounded-xl glass-input px-3 py-2.5 text-sm placeholder-[#0f2846]/40 transition"
            />
          </div>

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0f2846] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0f2846]/90 shadow-md focus:outline-none focus:ring-2 focus:ring-[#0f2846] focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transition min-h-[44px]"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-[#0f2846]/50 mt-8 font-medium tracking-wide uppercase">
          Digital GR System · Secure login
        </p>
      </div>
    </main>
  )
}
