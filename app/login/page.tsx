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
    <main className="min-h-screen flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#1a1a1a]">
            Digital GR
          </h1>
          <p className="text-sm text-[#6b6b6b] mt-2 font-medium">
            School Record System
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleLogin}
          className="neu-card p-7 space-y-5"
        >
          {/* Error */}
          {error && (
            <div
              id="login-error"
              className="border-brutal rounded-lg bg-red-50 px-4 py-3 border-red-500"
              role="alert"
              style={{ borderColor: '#dc2626' }}
            >
              <p className="text-sm text-red-700 font-semibold">{error}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-bold uppercase tracking-wider text-[#6b6b6b] mb-2"
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
              className="neu-input"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-wider text-[#6b6b6b] mb-2"
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
              className="neu-input"
            />
          </div>

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="neu-btn neu-btn-primary w-full"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-[#9a9590] mt-8 font-semibold uppercase tracking-widest">
          Secure Login
        </p>
      </div>
    </main>
  )
}
