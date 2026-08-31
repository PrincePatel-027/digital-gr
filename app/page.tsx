'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { toGujaratiDigits } from '@/lib/gujarati'

// A few specimen rows, written the way a clerk writes them.
const SPECIMEN = [
  { gr: '5202', name: 'નંદનીબેન ઉપેન્દ્રભાઈ બારોટ', father: 'ઉપેન્દ્રભાઈ', std: '5', dob: '06-01-2016', left: false },
  { gr: '5203', name: 'મીરાબેન રમેશભાઈ પ્રજાપતિ', father: 'રમેશભાઈ', std: '4', dob: '14-08-2016', left: false },
  { gr: '5204', name: 'જયેશ દિનેશભાઈ ઠાકોર', father: 'દિનેશભાઈ', std: '7', dob: '02-03-2014', left: true },
]

const subscribeToHydration = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export default function LandingPage() {
  const router = useRouter()
  const { session, loading } = useAuth()
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot
  )

  useEffect(() => {
    if (!loading && session) router.replace('/dashboard')
  }, [session, loading, router])

  if (!mounted) return null

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ── Masthead ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 glass-nav">
        <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 h-16 flex items-center justify-between">
          <div>
            <span className="block font-gujarati-serif text-base font-semibold leading-none">જનરલ રજિસ્ટર</span>
            <span className="eyebrow block mt-1">Digital GR</span>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="neu-btn neu-btn-ghost min-h-[40px] px-5 text-sm"
          >
            Sign in
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero: the register itself ──────────────────────── */}
        <section className="max-w-6xl mx-auto w-full px-5 sm:px-8 pt-12 pb-16 sm:pt-16 sm:pb-20">
          <div className="max-w-3xl">
            <p className="eyebrow mb-4 animate-fade-up">
              પત્રક ૪ / પત્રક ૫ · Gujarat primary schools
            </p>
            <h1
              className="font-gujarati-serif text-[clamp(2.1rem,5.5vw,3.6rem)] leading-[1.15] mb-5 animate-fade-up"
              style={{ animationDelay: '60ms' }}
            >
              શાળાનું જનરલ રજિસ્ટર,
              <br />
              <span className="text-accent">ડિજિટલ સ્વરૂપે.</span>
            </h1>
            <p
              className="text-lg text-ink-soft max-w-[54ch] leading-relaxed mb-8 animate-fade-up"
              style={{ animationDelay: '120ms' }}
            >
              Photograph a page of the bound register. Each student&apos;s details
              are read from the handwriting and laid out exactly as the register
              records them — then kept searchable, and private to your school.
            </p>
            <div
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-fade-up"
              style={{ animationDelay: '180ms' }}
            >
              <button onClick={() => router.push('/login')} className="neu-btn neu-btn-accent px-8">
                Open your register
              </button>
              <a href="#how" className="neu-btn neu-btn-ghost px-8">
                How it works
              </a>
            </div>
          </div>

          {/* The ledger — the thing itself, not an illustration of it */}
          <div
            className="mt-12 sm:mt-16 neu-card overflow-hidden animate-fade-up"
            style={{ animationDelay: '240ms' }}
          >
            <div className="px-5 py-3 border-b border-line-strong bg-surface-2 flex items-center justify-between">
              <div>
                <p className="font-gujarati-serif text-sm font-semibold">રજિસ્ટર અનુક્રમણિકા</p>
                <p className="label-en">Register index · specimen</p>
              </div>
              <span className="eyebrow hidden sm:block">શિક્ષણ સમિતિ</span>
            </div>
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th className="col-serial">#</th>
                    <th>રજી. નં<span className="en">GR no</span></th>
                    <th>પુરૂં નામ<span className="en">Full name</span></th>
                    <th className="hidden sm:table-cell">પિતાનું નામ<span className="en">Father</span></th>
                    <th>ધોરણ<span className="en">Std</span></th>
                    <th className="hidden sm:table-cell">જન્મ તારીખ<span className="en">Date of birth</span></th>
                    <th>સ્થિતિ<span className="en">Status</span></th>
                  </tr>
                </thead>
                <tbody>
                  {SPECIMEN.map((row, i) => (
                    <tr key={row.gr} className={row.left ? 'entry-left' : ''}>
                      <td className="col-serial">{toGujaratiDigits(i + 1)}</td>
                      <td>
                        <span className={`gr-stamp ${row.left ? 'gr-stamp-left' : ''}`}>{row.gr}</span>
                      </td>
                      <td className="font-gujarati font-semibold whitespace-nowrap">{row.name}</td>
                      <td className="font-gujarati text-sm hidden sm:table-cell">{row.father}</td>
                      <td className="font-gujarati text-sm">{toGujaratiDigits(row.std)}</td>
                      <td className="text-mono text-xs hidden sm:table-cell">{row.dob}</td>
                      <td className="font-gujarati text-xs font-semibold">
                        {row.left ? (
                          <span className="text-red-ink">છોડી ગયા</span>
                        ) : (
                          <span className="text-accent">ચાલુ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────── */}
        <section id="how" className="border-t border-line-strong bg-surface scroll-mt-20">
          <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-14 sm:py-20">
            <h2 className="font-gujarati-serif text-2xl sm:text-3xl mb-2">કેવી રીતે કામ કરે છે</h2>
            <p className="text-ink-soft max-w-[52ch] mb-12">
              No new hardware and no data-entry marathon. The register you already
              keep is the only input.
            </p>

            <ol className="grid md:grid-cols-3 gap-x-10 gap-y-10">
              {[
                {
                  n: '૧',
                  gu: 'પાનું સ્કેન કરો',
                  t: 'Scan the page',
                  d: 'Photograph any register page on a phone, or upload a scan you already have.',
                },
                {
                  n: '૨',
                  gu: 'વિગતો તપાસો',
                  t: 'Check the details',
                  d: 'The Gujarati handwriting is read into the register\'s own columns. Anything uncertain is flagged for you to confirm.',
                },
                {
                  n: '૩',
                  gu: 'શોધો અને સાચવો',
                  t: 'Find and keep',
                  d: 'Look up a student by GR number, name or standard in seconds. Only your school can open your register.',
                },
              ].map((step) => (
                <li key={step.n} className="border-t-2 border-ink pt-4">
                  <span className="font-gujarati-serif text-3xl text-accent">{step.n}</span>
                  <h3 className="font-gujarati-serif text-lg font-semibold mt-2">{step.gu}</h3>
                  <p className="label-en mb-2">{step.t}</p>
                  <p className="text-sm text-ink-soft leading-relaxed">{step.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Close ─────────────────────────────────────────── */}
        <section className="border-t border-line-strong">
          <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-14 sm:py-20 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div>
              <p className="font-gujarati-serif text-2xl sm:text-3xl leading-snug max-w-[24ch]">
                દરેક વિદ્યાર્થીની નોંધ, <span className="text-accent">કાયમ સુરક્ષિત</span>.
              </p>
              <p className="text-ink-soft mt-3">
                Every entry preserved, long after the paper fades.
              </p>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="neu-btn neu-btn-accent px-9 self-start lg:self-auto"
            >
              Open your register
            </button>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-line-strong bg-surface">
        <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 py-7 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="block font-gujarati-serif text-sm font-semibold">જનરલ રજિસ્ટર</span>
            <span className="eyebrow">Digital GR</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-ink-soft">
            <a href="mailto:support@digitalgr.app" className="hover:text-ink transition-colors">
              Contact
            </a>
            <button onClick={() => router.push('/login')} className="hover:text-ink transition-colors">
              Sign in
            </button>
          </div>
          <p className="text-xs text-ink-faint">© {new Date().getFullYear()} Digital GR</p>
        </div>
      </footer>
    </div>
  )
}
