import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center text-center px-5 py-16">
      <p className="text-mono text-sm font-semibold text-accent mb-5 tracking-wide">404</p>
      <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] leading-[1.02] mb-4">
        This page isn&apos;t <span className="italic text-accent">in the register</span>.
      </h1>
      <p className="text-ink-soft max-w-[46ch] mb-9">
        The page you were looking for may have been moved, or the link might be
        incomplete. Let&apos;s get you back on track.
      </p>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Link href="/dashboard" className="neu-btn neu-btn-primary px-8">
          Back to dashboard
        </Link>
        <Link href="/" className="neu-btn neu-btn-ghost px-8">
          Go home
        </Link>
      </div>
    </main>
  )
}
