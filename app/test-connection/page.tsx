import { supabase } from '@/lib/supabase'

export const metadata = {
  title: 'Supabase Connection Test | digit-gr',
}

async function testConnection() {
  try {
    // getSession() is the lightest possible Supabase call:
    // it hits the Auth API (not PostgREST), so it works even if
    // no tables exist yet and regardless of RLS policies.
    const { error } = await supabase.auth.getSession()

    if (error) {
      return { ok: false, message: error.message }
    }

    return { ok: true, message: 'Connected to Supabase successfully!' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, message }
  }
}

export default async function TestConnectionPage() {
  const result = await testConnection()

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="max-w-md w-full mx-4">
        <div
          className={`rounded-2xl border p-8 shadow-2xl ${
            result.ok
              ? 'border-emerald-500/30 bg-emerald-950/40'
              : 'border-red-500/30 bg-red-950/40'
          }`}
        >
          {/* Status icon */}
          <div className="flex justify-center mb-6">
            {result.ok ? (
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Heading */}
          <h1
            className={`text-2xl font-bold text-center mb-2 ${
              result.ok ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {result.ok ? 'Connected' : 'Connection Failed'}
          </h1>

          {/* Message */}
          <p className="text-center text-sm text-gray-400 mb-6">
            {result.message}
          </p>

          {/* Details */}
          <div className="rounded-lg bg-gray-900/60 border border-gray-800 p-4 text-xs font-mono space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">URL</span>
              <span className="text-gray-300 truncate max-w-[200px]">
                {process.env.NEXT_PUBLIC_SUPABASE_URL ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Key prefix</span>
              <span className="text-gray-300">
                {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(0, 12) + '…'
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Environment</span>
              <span className="text-gray-300">
                {process.env.NODE_ENV ?? 'unknown'}
              </span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          digit-gr · Supabase connection check
        </p>
      </div>
    </main>
  )
}
