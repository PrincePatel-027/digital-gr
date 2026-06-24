'use client'

import GRRecordForm from '@/components/GRRecordForm'

export default function NewRecordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">New GR Record</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Upload a scanned image and fill in the student details.
        </p>
      </div>

      <GRRecordForm mode="create" />
    </div>
  )
}
