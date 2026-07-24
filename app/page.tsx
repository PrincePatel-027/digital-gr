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

  const year = new Date().getFullYear()

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 glass-nav">
        <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 h-16 flex items-center justify-between">
          <span className="font-display text-2xl tracking-tight">Digital GR</span>
          <button
            onClick={() => router.push('/login')}
            className="neu-btn neu-btn-ghost min-h-[42px] px-5 text-sm"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto w-full px-5 sm:px-8 pt-14 pb-20 sm:pt-20 sm:pb-28 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 lg:gap-10 items-center">
          {/* Copy */}
          <div>
            <p
              className="animate-fade-up inline-flex items-center gap-2 text-xs font-semibold text-ink-soft mb-6"
              style={{ animationDelay: '40ms' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              For schools
              <span className="text-ink-faint">·</span>
              <span className="font-gujarati">પત્રક ૪ / ૫</span>
            </p>

            <h1
              className="animate-fade-up text-[clamp(2.7rem,7vw,4.8rem)] leading-[1.0] mb-6"
              style={{ animationDelay: '120ms' }}
            >
              The General Register,
              <br />
              <span className="italic text-accent">digitized.</span>
            </h1>

            <p
              className="animate-fade-up text-lg text-ink-soft max-w-[52ch] leading-relaxed mb-9"
              style={{ animationDelay: '200ms' }}
            >
              Photograph a register page. We read the Gujarati and English
              handwriting, pull out each student&apos;s details, and keep them
              searchable and safe, for decades.
            </p>

            <div
              className="animate-fade-up flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              style={{ animationDelay: '280ms' }}
            >
              <button
                onClick={() => router.push('/login')}
                className="neu-btn neu-btn-primary px-8"
              >
                Get started
              </button>
              <a href="#how" className="neu-btn neu-btn-ghost px-8">
                See how it works
              </a>
            </div>
          </div>

          {/* Before → after visual */}
          <div
            className="animate-scale-in relative mx-auto w-full max-w-md lg:max-w-none"
            style={{ animationDelay: '360ms' }}
            aria-hidden="true"
          >
            {/* Aged ledger page (the "before") */}
            <div className="relative rotate-[-4deg] rounded-2xl bg-surface-2 border border-line-strong shadow-[var(--shadow-lg)] p-6 sm:p-7">
              <div className="flex items-center justify-between mb-4">
                <span className="font-gujarati text-sm text-ink-soft">શાળા સામાન્ય રજિસ્ટર</span>
                <span className="text-[10px] font-semibold text-ink-faint uppercase tracking-widest">Scan</span>
              </div>
              {/* faux hand-written ruled lines */}
              <div className="space-y-3">
                {['ક્રમાંક ૧૨૪૭ — મીરા પ્રજાપતિ', 'જન્મ ૧૪/૦૮/૨૦૧૫ — ધો. ૫', 'પિતા: રમેશભાઈ પ્રજાપતિ'].map((line, i) => (
                  <div key={i} className="border-b border-line-strong pb-2.5">
                    <span className="font-gujarati text-[13px] text-ink/70">{line}</span>
                  </div>
                ))}
                <div className="border-b border-line-strong pb-2.5 opacity-50">
                  <span className="font-gujarati text-[13px] text-ink/60">ગામ: વડોદરા</span>
                </div>
              </div>
            </div>

            {/* Digitized record (the "after") */}
            <div className="absolute -bottom-8 -right-2 sm:-right-6 w-[74%] rotate-[3deg] neu-card shadow-[var(--shadow-lg)] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-mono text-xs font-semibold bg-ink text-paper px-2.5 py-1 rounded-md">
                  GR-1247
                </span>
                <span className="neu-badge bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[color:var(--color-success)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-success)]" />
                  Extracted
                </span>
              </div>
              <p className="font-semibold text-[15px] mb-3">Meera Prajapati</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <div>
                  <dt className="text-ink-faint mb-0.5">Date of birth</dt>
                  <dd className="text-mono text-ink">14/08/2015</dd>
                </div>
                <div>
                  <dt className="text-ink-faint mb-0.5">Standard</dt>
                  <dd className="text-mono text-ink">5</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-ink-faint mb-0.5">Father</dt>
                  <dd className="text-ink font-medium">Ramesh Prajapati</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────── */}
        <section id="how" className="border-t border-line scroll-mt-20">
          <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-16 sm:py-24">
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight mb-3">
              Three steps from paper to pixels
            </h2>
            <p className="text-ink-soft max-w-[48ch] mb-14">
              No new hardware, no data entry marathons. Your existing registers are
              all you need.
            </p>

            <ol className="grid md:grid-cols-3 gap-x-10 gap-y-12">
              {[
                {
                  n: '01',
                  t: 'Scan or upload',
                  d: 'Snap a photo of any register page, or upload an existing scan. Photos, PDFs, whatever you already have on file.',
                },
                {
                  n: '02',
                  t: 'OCR reads it',
                  d: 'Handwriting in Gujarati and English is extracted into clean fields, with a confidence flag on every value so nothing slips through.',
                },
                {
                  n: '03',
                  t: 'Search & manage',
                  d: 'Find any student by name, GR number or date in seconds. Role-based access keeps every record safe.',
                },
              ].map((step) => (
                <li key={step.n} className="border-t-2 border-ink pt-5">
                  <span className="font-display text-4xl text-accent tabular-nums">{step.n}</span>
                  <h3 className="text-lg font-semibold mt-3 mb-2">{step.t}</h3>
                  <p className="text-sm text-ink-soft leading-relaxed">{step.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Closing statement ─────────────────────────────── */}
        <section className="border-t border-line bg-surface">
          <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-16 sm:py-24 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
            <div>
              <p className="font-display text-3xl sm:text-4xl leading-tight tracking-tight max-w-[18ch]">
                Every name in the register, <span className="italic text-accent">preserved</span>.
              </p>
              <p className="font-gujarati text-ink-soft mt-4 text-lg">
                દરેક વિદ્યાર્થીની વિગત સુરક્ષિત અને શોધવા યોગ્ય.
              </p>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="neu-btn neu-btn-primary px-9 self-start lg:self-auto"
            >
              Get started
            </button>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display text-lg">Digital GR</span>
          <div className="flex items-center gap-6 text-sm text-ink-soft">
            <a href="mailto:support@digitalgr.app" className="hover:text-ink transition-colors">
              Contact
            </a>
            <button onClick={() => router.push('/login')} className="hover:text-ink transition-colors">
              Sign in
            </button>
          </div>
          <p className="text-xs text-ink-faint">© {year} Digital GR</p>
        </div>
      </footer>
    </div>
  )
}
