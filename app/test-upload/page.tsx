'use client'

import { useState } from 'react'
import ImageUploader from '@/components/ImageUploader'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

export default function TestUploadPage() {
  const { profile, loading } = useAuth()
  const [uploadedPath, setUploadedPath] = useState<string | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  async function handleUpload(path: string) {
    setUploadedPath(path)

    // Generate a signed URL to prove the file is readable
    const { data, error } = await supabase.storage
      .from('gr-images')
      .createSignedUrl(path, 60 * 5) // 5 min expiry

    if (data?.signedUrl) {
      setSignedUrl(data.signedUrl)
    } else {
      console.error('Signed URL error:', error?.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-400">
        Loading…
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center space-y-3">
          <p className="text-gray-300">You must be logged in to test uploads.</p>
          <a href="/login" className="text-indigo-400 hover:text-indigo-300 text-sm underline">
            Go to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Image Upload Test</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Logged in as <strong>{profile.full_name}</strong> ({profile.role})
            {profile.school_id && (
              <span className="text-gray-500"> · School: {profile.school_id.slice(0, 8)}…</span>
            )}
          </p>
        </div>

        {/* Uploader */}
        <ImageUploader onUpload={handleUpload} />

        {/* Result */}
        {uploadedPath && (
          <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Upload Result
            </h2>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Storage path:</span>
                <code className="ml-2 text-indigo-300 bg-gray-800/60 px-2 py-0.5 rounded text-xs">
                  {uploadedPath}
                </code>
              </div>

              {signedUrl && (
                <div>
                  <span className="text-gray-500">Signed URL:</span>
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-indigo-400 hover:text-indigo-300 text-xs underline break-all"
                  >
                    Open in new tab ↗
                  </a>
                </div>
              )}
            </div>

            {signedUrl && (
              <div className="rounded-lg border border-gray-700 overflow-hidden">
                <img
                  src={signedUrl}
                  alt="Uploaded file from storage"
                  className="w-full max-h-80 object-contain bg-gray-950"
                />
                <p className="text-xs text-gray-600 px-3 py-2 bg-gray-800/40">
                  ↑ Loaded from Supabase Storage (signed URL, 5 min expiry)
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
