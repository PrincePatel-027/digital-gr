'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

// ── Types ─────────────────────────────────────────────────────
interface ImageUploaderProps {
  /** Called with the storage path after successful upload */
  onUpload: (path: string) => void
  /** Optional: called with the File object when selected (before upload) */
  onFileSelect?: (file: File) => void
  /** Optional: override the school_id folder (defaults to auth context) */
  schoolId?: string
  /** Optional: additional CSS classes for the container */
  className?: string
  /** Optional: disable the component */
  disabled?: boolean
}

// ── Component ─────────────────────────────────────────────────
export default function ImageUploader({
  onUpload,
  onFileSelect,
  schoolId: schoolIdProp,
  className = '',
  disabled = false,
}: ImageUploaderProps) {
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const schoolId = schoolIdProp || profile?.school_id

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setError(null)
      setUploaded(false)
      setFileName(file.name)

      // Preview
      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target?.result as string)
      reader.readAsDataURL(file)

      onFileSelect?.(file)

      // Upload
      if (!schoolId) {
        setError('Unable to determine school. Please log in again.')
        return
      }

      setUploading(true)

      try {
        // Generate unique filename: school_id/uuid.ext
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const uuid = crypto.randomUUID()
        const storagePath = `${schoolId}/${uuid}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('gr-images')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw new Error(uploadError.message)
        }

        setUploaded(true)
        onUpload(storagePath)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`Upload failed: ${msg}`)
      } finally {
        setUploading(false)
      }
    },
    [schoolId, onUpload, onFileSelect]
  )

  const handleReset = () => {
    setPreview(null)
    setUploaded(false)
    setError(null)
    setFileName(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* File input area */}
      {!preview ? (
        <label
          htmlFor="image-upload"
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed
            ${disabled ? 'border-gray-800 bg-gray-900/30 cursor-not-allowed' : 'border-gray-700 bg-gray-900/40 hover:border-indigo-500/50 hover:bg-gray-800/40 cursor-pointer'}
            transition p-8 text-center`}
        >
          <svg
            className="w-10 h-10 text-gray-500 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm text-gray-400 mb-1">
            <span className="text-indigo-400 font-medium">Click to upload</span>{' '}
            or drag and drop
          </p>
          <p className="text-xs text-gray-600">
            JPG, PNG, WebP, TIFF, or PDF — max 10 MB
          </p>
          <input
            ref={fileRef}
            id="image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/tiff,application/pdf"
            capture="environment"
            onChange={handleFileChange}
            disabled={disabled || uploading}
            className="sr-only"
          />
        </label>
      ) : (
        /* Preview + status */
        <div className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
          {/* Image */}
          <div className="relative">
            <img
              src={preview}
              alt="Upload preview"
              className="w-full max-h-64 object-contain bg-gray-950"
            />

            {/* Uploading overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-gray-950/70 flex items-center justify-center">
                <div className="flex items-center gap-3 text-white">
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span className="text-sm font-medium">Uploading…</span>
                </div>
              </div>
            )}

            {/* Success overlay */}
            {uploaded && (
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/80 border border-emerald-700/50 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Uploaded
                </span>
              </div>
            )}
          </div>

          {/* File info bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-800">
            <span className="text-xs text-gray-400 truncate max-w-[200px]">
              {fileName}
            </span>
            <button
              onClick={handleReset}
              disabled={uploading}
              className="text-xs text-gray-500 hover:text-white transition disabled:opacity-30"
            >
              Replace
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-lg bg-red-950/50 border border-red-800/50 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  )
}
