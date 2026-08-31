'use client'

import Link from 'next/link'
import GRRecordForm from '@/components/GRRecordForm'

export default function NewRecordPage() {
  return (
    <div className="space-y-7">
      <div>
        <Link
          href="/dashboard/records"
          className="text-sm font-medium text-ink-soft hover:text-ink mb-4 inline-flex items-center gap-1.5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to records
        </Link>
        <h1 className="text-3xl sm:text-4xl">New record</h1>
        <p className="text-sm text-ink-soft mt-2">
          Scan a register page or dictate a new admission, then confirm every extracted field before saving.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          <Link href="/dashboard/records/compare" className="text-xs font-semibold text-accent hover:underline">
            Compare OCR engines →
          </Link>
          <Link href="/dashboard/records/voice-compare" className="text-xs font-semibold text-accent hover:underline">
            Compare voice models →
          </Link>
        </div>
      </div>

      <GRRecordForm mode="create" />
    </div>
  )
}
